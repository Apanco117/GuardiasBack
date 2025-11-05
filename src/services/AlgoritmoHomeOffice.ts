import mongoose from 'mongoose';

import Usuario, { UsuarioType } from '../models/Usuario';
import { AusenciaType } from '../models/Ausencia';
import CalendarioHomeOffice from '../models/HomeOffice';
import { DiaFestivoType } from '../models/DiasFestivos';
import { CalendarioGuardiaType } from '../models/CalendarioGuardia';

const DIAS_HO_POR_SEMANA = 1;

const logResumenSemanal = (
    titulo: string,
    dayCounts: Map<string, number>, // Mapa de conteos por día
    usuariosElegibles: UsuarioConJusticiaHO[],
    diasHabiles: Date[]
) => {
    const totalAsignados = Array.from(dayCounts.values()).reduce((a, b) => a + b, 0);
    const totalEsperado = usuariosElegibles.length * DIAS_HO_POR_SEMANA;
    const diasSemana = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

    console.log(`     -------------------------------------------------`);
    console.log(`     ${titulo}`);
    console.log(`     -> Asignados: ${totalAsignados} de ${totalEsperado} (Posibles)`);
    
    // Imprimir el conteo por día (para ver la consistencia)
    diasHabiles.forEach(dia => {
        const diaISO = dia.toISOString();
        const nombreDia = `${diasSemana[dia.getUTCDay()]} ${dia.getUTCDate()}`;
        console.log(`       -> ${nombreDia.padEnd(10)}: ${dayCounts.get(diaISO) || 0} personas`);
    });

    if (totalAsignados < totalEsperado) {
        console.warn(`     -> ¡FALTARON ASIGNACIONES!`);
        // (La lógica para mostrar quién faltó es más compleja ahora,
        // pero el log de asignados vs esperados lo deja claro)
    }
    console.log(`     -------------------------------------------------`);
};

interface UsuarioConJusticiaHO extends UsuarioType {
    ultimaHomeOfficeParaSort: Date | null;
    asignadosEsteMes: number; 
}

export const algoritmoGenerarHomeOffice = async (
    mes: number,
    anio: number,
    usuariosActivos: UsuarioType[],
    ausenciasDelMes: AusenciaType[],
    diasFestivosDelMes: DiaFestivoType[],
    guardiasDelMes: CalendarioGuardiaType[] 
) => {
    const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const fechaInicioMes = new Date(Date.UTC(anio, mes - 1, 1));
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    const usuariosParaHO = usuariosActivos.filter(u => u.tieneHomeOffice);
    if (usuariosParaHO.length === 0) {
        console.log("No hay usuarios elegibles para Home Office. Saltando.");
        return;
    }
    let usuariosConJusticia: UsuarioConJusticiaHO[] = await Promise.all(
        usuariosParaHO.map(async (u) => {
            const ultimaHOReal = await CalendarioHomeOffice.findOne({
                idUsuario: u._id,
                fecha: { $lt: fechaInicioMes }, // La última HO antes de este mes
            }).sort({ fecha: -1 });
            //console.log(`Usuario: ${u.nombre}, Última HO: ${ultimaHOReal ? ultimaHOReal.fecha.toISOString().split('T')[0] : 'Ninguna'}`);    
            return {
                ...u.toObject(), 
                _id: u._id,
                idSistema: u.idSistema,
                ultimaHomeOfficeParaSort: ultimaHOReal ? ultimaHOReal.fecha : null,
                asignadosEsteMes: 0, // Aún no se ha asignado nada
            };
        })
    );

    const guardiasPorDia = new Map<string, CalendarioGuardiaType>();
    // Mapear las guardias por fecha para acceso rápido
    guardiasDelMes.forEach(g => {
        guardiasPorDia.set(g.fecha.toISOString(), g);
    });
    const ausenciasPorDia = new Map<string, Set<string>>();
    for (const aus of ausenciasDelMes) {
        // Creamos copias de las fechas de inicio y fin para iterar
        const fechaInicioAusencia = new Date(aus.fechaInicio);
        const fechaFinAusencia = new Date(aus.fechaFin);
        
        let fechaIter = new Date(Date.UTC(
            fechaInicioAusencia.getUTCFullYear(),
            fechaInicioAusencia.getUTCMonth(),
            fechaInicioAusencia.getUTCDate()
        ));
        
        const fechaFin = new Date(Date.UTC(
            fechaFinAusencia.getUTCFullYear(),
            fechaFinAusencia.getUTCMonth(),
            fechaFinAusencia.getUTCDate()
        ));
        
        while(fechaIter <= fechaFin) {
            const fechaISO = fechaIter.toISOString();
            if (!ausenciasPorDia.has(fechaISO)) {
                ausenciasPorDia.set(fechaISO, new Set<string>());
            }
            console.log(`Marcando ausencia para usuario ${aus.idUsuario} en fecha ${fechaISO}`);
            ausenciasPorDia.get(fechaISO)!.add(aus.idUsuario.toString());
            
            fechaIter.setUTCDate(fechaIter.getUTCDate() + 1);
        }
    }
    // Mapear dias festivos para acceso rápido
    const festivosSet = new Set<string>(
        diasFestivosDelMes.map(f => f.fecha.toISOString())
    );

    // Hacer conteo de personas por sistema
    const conteoSistemas: { [key: string]: number } = {};
    usuariosParaHO.forEach(u => {
        if (u.idSistema) {
            const idSistemaStr = u.idSistema.toString();
            conteoSistemas[idSistemaStr] = (conteoSistemas[idSistemaStr] || 0) + 1;
        }
    });
    let diaActual = 1;
    while(diaActual <= diasDelMes) {
        //console.log(`--- Procesando Semana a partir del Día ${diaActual} ---`);
    
        // 1. CALCULAR DÍAS DE ESTA SEMANA (hasta el Domingo o fin de mes)
        const diasDeEstaSemana: Date[] = [];
        let diaSemanaActual = diaActual;
        console.log(`Dia de semana actual inicia en: ${diaSemanaActual}`);

        while(diaSemanaActual <= diasDelMes) {
            const fecha = new Date(Date.UTC(anio, mes - 1, diaSemanaActual));
            diasDeEstaSemana.push(fecha);
            
            const dayOfWeek = fecha.getUTCDay();
            //console.log(`${fecha}`)
            diaSemanaActual++;
            if (dayOfWeek === 0) { // Si es Domingo
                break; // Terminamos esta semana
            }
        }
        
        const diasHabilesSemana: Date[] = diasDeEstaSemana.filter(fecha => {
            // Evaluar si es día hábil
            const dayOfWeek = fecha.getUTCDay();
            const esHabil = (dayOfWeek >= 1 && dayOfWeek <= 5);
            const esFestivo = festivosSet.has(fecha.toISOString());
            return esHabil && !esFestivo;
        });

        //for (const dia of diasHabilesSemana) {
        //    console.log(`     Procesando día hábil: ${dia.toISOString().split('T')[0]} (${diasSemana[dia.getUTCDay()]})`);
        //}
        
        // Si esta semana no tiene días hábiles (ej. Sáb 1 y Dom 2 de Nov)
        if (diasHabilesSemana.length === 0) {
            console.log("     No hay días hábiles en este bloque semanal. Saltando.");
            diaActual = diaSemanaActual; // Avanzamos al siguiente bloque
            continue;
        }

         const cupoSemanal = Math.ceil( // Usuarios para la semana
            (usuariosConJusticia.length * (diasHabilesSemana.length / 5)) * DIAS_HO_POR_SEMANA
        );

        console.log(`     Total usuarios HO: ${usuariosConJusticia.length}. Cupo proporcional para esta semana: ${cupoSemanal}`);

         usuariosConJusticia.sort(
            (a, b) => (a.ultimaHomeOfficeParaSort?.getTime() || 0) - (b.ultimaHomeOfficeParaSort?.getTime() || 0)
        );

        const candidatosEstaSemana = usuariosConJusticia.slice(0, cupoSemanal);
        let asignadosSemanaCount = 0;

        const dayCounts = new Map<string, number>();
        diasHabilesSemana.forEach(dia => {
            dayCounts.set(dia.toISOString(), 0)
        });

        // Evaluar cada candidato
        for (const usuario of candidatosEstaSemana) {
            let mejorDia: Date | null = null;
            let puntajeMasAlto = -Infinity;

            // Iterar dias de la semana
            for (const dia of diasHabilesSemana) {
                const fechaISO = dia.toISOString();
                let puntajeActual = 100;

                // Verficar asucencia del usuario
                if (ausenciasPorDia.has(fechaISO) && ausenciasPorDia.get(fechaISO)!.has(usuario._id.toString())) {
                    puntajeActual = -Infinity;
                    console.log(`       -> ${usuario.nombre} RECHAZADO (Ausencia) el ${fechaISO.split('T')[0]}`);
                    continue; // No puede este día, probar el siguiente día
                }
                // Verificar guardias asignadas
                const guardia = guardiasPorDia.get(fechaISO);
                if (guardia && (guardia.idUsuarioPrincipal.equals(usuario._id) || guardia.idUsuarioApoyo.equals(usuario._id))) {
                    puntajeActual = -Infinity;
                    //console.log(`       -> ${usuario.nombre} RECHAZADO (Guardia) el ${fechaISO.split('T')[0]}`);
                    continue; // No puede este día
                }
                if (usuario.idSistema) {
                    const idSistemaStr = usuario.idSistema.toString();
                    // Verificar cuota por sistema
                    if ((conteoSistemas[idSistemaStr] || 0) <= 2 && guardia) {

                        const principalEnGuardia = usuariosConJusticia.find(u => u._id.equals(guardia.idUsuarioPrincipal));
                        const apoyoEnGuardia = usuariosConJusticia.find(u => u._id.equals(guardia.idUsuarioApoyo));

                        const compañeroEnGuardia = 
                            (principalEnGuardia?.idSistema && principalEnGuardia.idSistema.equals(usuario.idSistema)) ||
                            (apoyoEnGuardia?.idSistema && apoyoEnGuardia.idSistema.equals(usuario.idSistema));
                    
                        if (compañeroEnGuardia) {
                            puntajeActual = -Infinity;
                            //console.log(`       -> ${usuario.nombre} RECHAZADO (Conflicto Cobertura) el ${fechaISO.split('T')[0]}`);
                            continue; // No puede este día
                        }
                    }
                }

                const asignadosEsteDia = dayCounts.get(fechaISO) || 0;
                puntajeActual -= asignadosEsteDia * 10;

                // Penalizar por repetir día de la semana
                if (usuario.ultimaHomeOfficeParaSort && usuario.ultimaHomeOfficeParaSort.getUTCDay() === dia.getUTCDay()) {
                    puntajeActual -= 50; // Penalización fuerte por repetir (ej. todos los lunes)
                }

                // desicion
                if (puntajeActual > puntajeMasAlto) {
                    puntajeMasAlto = puntajeActual;
                    mejorDia = dia;
                }

            }
            if (mejorDia) {
                const fechaISO = mejorDia.toISOString();
                console.log(`     -> ASIGNADO: ${usuario.nombre} el ${fechaISO.split('T')[0]}`);
                
                // Guardar en BD (lo hacemos 'await' al final)
                const nuevoHO = new CalendarioHomeOffice({ fecha: mejorDia, idUsuario: usuario._id });
                nuevoHO.save(); // (Disparamos el guardado)

                // Actualizar trackers en memoria para el siguiente usuario/semana
                usuario.ultimaHomeOfficeParaSort = mejorDia;
                usuario.asignadosEsteMes++;
                dayCounts.set(fechaISO, (dayCounts.get(fechaISO) || 0) + 1);
                asignadosSemanaCount++;
            } else {
                console.log(`     -> ADVERTENCIA: No se encontró día válido para ${usuario.nombre} esta semana.`);
            }
        }

        diaActual = diaSemanaActual;
    }
};

const checkFechaEnRango = (check: Date, inicio: Date, fin: Date): boolean => {
    const f = new Date(check);
    const fInicio = new Date(inicio);
    const fFin = new Date(fin);
    f.setHours(0, 0, 0, 0);
    fInicio.setHours(0, 0, 0, 0);
    fFin.setHours(0, 0, 0, 0);
    return f.getTime() >= fInicio.getTime() && f.getTime() <= fFin.getTime();
};