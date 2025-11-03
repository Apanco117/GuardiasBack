import mongoose from 'mongoose';

import Usuario, { UsuarioType } from '../models/Usuario';
import { AusenciaType } from '../models/Ausencia';
import CalendarioHomeOffice from '../models/HomeOffice';
import { DiaFestivoType } from '../models/DiasFestivos';
import { CalendarioGuardiaType } from '../models/CalendarioGuardia';

const DIAS_HO_POR_SEMANA = 1;


interface UsuarioConJusticiaHO extends UsuarioType {
    ultimaHomeOfficeParaSort: Date | null;
}

export const algoritmoGenerarHomeOffice = async (
    mes: number,
    anio: number,
    usuariosActivos: UsuarioType[],
    ausenciasDelMes: AusenciaType[],
    diasFestivosDelMes: DiaFestivoType[],
    guardiasDelMes: CalendarioGuardiaType[] 
) => {
    const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate(); // Cantidad de dias
    const fechaInicioMes = new Date(Date.UTC(anio, mes - 1, 1));    // Primer dia del mes
    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    const usuariosParaHO = usuariosActivos.filter(u => u.tieneHomeOffice);

    if (usuariosParaHO.length === 0) {
        console.log("No hay usuarios elegibles para Home Office. Saltando.");
        return;
    }

    const usuariosConJusticia: UsuarioConJusticiaHO[] = await Promise.all(
        usuariosParaHO.map(async (u) => {
            const ultimaHOReal = await CalendarioHomeOffice.findOne({
                idUsuario: u._id,
                fecha: { $lt: fechaInicioMes }, 
            }).sort({ fecha: -1 }); // 'desc'

            return {
                ...u.toObject(), 
                _id: u._id,
                idSistema: u.idSistema,
                ultimaHomeOfficeParaSort: ultimaHOReal ? ultimaHOReal.fecha : null,
            };
        })
    );

    const guardiasPorDia = new Map<string, CalendarioGuardiaType>(); // Mapa para acceso rápido por fecha

    guardiasDelMes.forEach(g => {
        guardiasPorDia.set(g.fecha.toISOString(), g);
    });

    const conteoSistemas: { [key: string]: number } = {}; // Cuenta la cantidad de usuarios por sistema

    usuariosParaHO.forEach(u => {
        if (u.idSistema) {
            const idSistemaStr = u.idSistema.toString();
            conteoSistemas[idSistemaStr] = (conteoSistemas[idSistemaStr] || 0) + 1; // Incrementa conteo o inicializa
        }
    });

    let usuarios = [...usuariosConJusticia]; // Copia de usuarios para manipular
    let asignadosEstaSemana = new Map<string, number>();

    //. Iterar cada dia del mes
    for (let dia = 1; dia <= diasDelMes; dia++) {
        const fechaActual = new Date(Date.UTC(anio, mes - 1, dia));
        const diaDeLaSemana = fechaActual.getUTCDay();

        // Saltar fines de semana
        if (diaDeLaSemana === 0 || diaDeLaSemana === 6) {
            console.log(` -> FIN DE SEMANA (HO). Saltando...`);
            continue; 
        }

        // Saltar dias festivos
        const esFestivo = diasFestivosDelMes.some(
            (festivo) => festivo.fecha.getTime() === fechaActual.getTime()
            );
        if (esFestivo) {
            console.log(` -> DÍA FESTIVO (HO). Saltando...`);
            continue;
        }

        if (diaDeLaSemana === 1) { 
            asignadosEstaSemana.clear(); // Limpiar conteo semanal
        }

        const cupoDiario = Math.ceil((usuarios.length * DIAS_HO_POR_SEMANA) / 5);

        const candidatosIniciales = usuarios.filter((u) => {
            const estaAusente = ausenciasDelMes.some(
                (aus) =>
                    checkFechaEnRango(fechaActual, aus.fechaInicio, aus.fechaFin) &&
                    aus.idUsuario.equals(u._id)
            );
            const cuotaSemanal = asignadosEstaSemana.get(u._id.toString()) || 0;
            return !estaAusente && cuotaSemanal < DIAS_HO_POR_SEMANA;
        });

        // Calcular puntajes para candidatos
        const candidatosConPuntaje = candidatosIniciales.map(usuario => {
            let puntaje = 100;

            puntaje += (usuario.ultimaHomeOfficeParaSort?.getTime() || 0);

            const guardiaHoy = guardiasPorDia.get(fechaActual.toISOString());

            if (guardiaHoy) {
                if (guardiaHoy.idUsuarioPrincipal.equals(usuario._id) || guardiaHoy.idUsuarioApoyo.equals(usuario._id)) {
                    puntaje = -Infinity; // Bloqueo total, no puede tener HO ya que tiene guardia
                }
            }
            // Analizar carga por sistema
            if (puntaje > -Infinity && usuario.idSistema) {
                const idSistemaStr = usuario.idSistema.toString(); // Id del sistema como string
                const totalSistema = conteoSistemas[idSistemaStr] || 0; // Total usuarios en ese sistema

                if (totalSistema <= 2) {  // Equipo pequeño
                    let compañeroEnGuardia = false;
                    if (guardiaHoy) {
                        const principal = usuariosActivos.find(u => u._id.equals(guardiaHoy.idUsuarioPrincipal));
                        const apoyo = usuariosActivos.find(u => u._id.equals(guardiaHoy.idUsuarioApoyo));

                        // Revisar si el principal es del mismo sistema
                        if (principal && principal.idSistema && principal.idSistema.equals(usuario.idSistema) && !principal._id.equals(usuario._id)) {
                            compañeroEnGuardia = true;
                        }
                        // Revisar si el apoyo es del mismo sistema
                        if (apoyo && apoyo.idSistema && apoyo.idSistema.equals(usuario.idSistema) && !apoyo._id.equals(usuario._id)) {
                            compañeroEnGuardia = true;
                        }
                    }
                    if (compañeroEnGuardia) {
                        puntaje = -Infinity; // Bloqueo total, no puede tener HO ya que su compañero de sistema tiene guardia
                    }
                }
            }
            return { usuario, puntaje };
        } )
        // Filtrar y ordenar candidatos finales con puntaje mas alto
        const candidatosFinales = candidatosConPuntaje.filter(c => c.puntaje > -Infinity).sort((a, b) => b.puntaje - a.puntaje); 
        const asignadosHoy = candidatosFinales.slice(0, cupoDiario);
        for (const { usuario } of asignadosHoy) {
            const nuevoHO = new CalendarioHomeOffice({
                fecha: fechaActual,
                idUsuario: usuario._id,
            });
            await nuevoHO.save();
            console.log(`         -> HO Asignado a: ${usuario.nombre}`);

            usuario.ultimaHomeOfficeParaSort = fechaActual;
      
            const idStr = usuario._id.toString();
            asignadosEstaSemana.set(idStr, (asignadosEstaSemana.get(idStr) || 0) + 1);
            
            await Usuario.updateOne({ _id: usuario._id }, { ultimaHomeOffice: fechaActual });
        }
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