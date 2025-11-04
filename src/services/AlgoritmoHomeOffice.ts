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
    asignadosEstaSemana: number; // Tracker para la cuota
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

  console.log(`--- Iniciando Generación de HOME OFFICE: ${mes}/${anio} ---`);

  // 1. Filtrar solo usuarios que tienen derecho a HO
  const usuariosParaHO = usuariosActivos.filter(u => u.tieneHomeOffice);
  if (usuariosParaHO.length === 0) {
    console.log("No hay usuarios elegibles para Home Office. Saltando.");
    return;
  }

  // 2. PASO DE JUSTICIA (para 'ultimaHomeOffice')
  let usuariosConJusticia: UsuarioConJusticiaHO[] = await Promise.all(
    usuariosParaHO.map(async (u) => {
      const ultimaHOReal = await CalendarioHomeOffice.findOne({
        idUsuario: u._id,
        fecha: { $lt: fechaInicioMes }, 
      }).sort({ fecha: -1 });

      return {
        ...u.toObject(), 
        _id: u._id,
        idSistema: u.idSistema,
        ultimaHomeOfficeParaSort: ultimaHOReal ? ultimaHOReal.fecha : null,
        asignadosEstaSemana: 0, // Inicializar tracker
      };
    })
  );

  // 3. Pre-calcular datos
  const guardiasPorDia = new Map<string, CalendarioGuardiaType>();
  guardiasDelMes.forEach(g => {
    guardiasPorDia.set(g.fecha.toISOString(), g);
  });

  const conteoSistemas: { [key: string]: number } = {};
  usuariosParaHO.forEach(u => {
    if (u.idSistema) {
      const idSistemaStr = u.idSistema.toString();
      conteoSistemas[idSistemaStr] = (conteoSistemas[idSistemaStr] || 0) + 1;
    }
  });

  // --- INICIA LOOP DEL MES (DÍA POR DÍA) ---
  // (Este loop ahora solo controla el avance de las semanas)
  
  let diaActual = 1;
  while(diaActual <= diasDelMes) {
    
    const fechaInicioSemana = new Date(Date.UTC(anio, mes - 1, diaActual));
    const diaDeLaSemana = fechaInicioSemana.getUTCDay();

    // 1. Avanzar hasta el Lunes (o el 1ro del mes)
    if (diaDeLaSemana !== 1 && diaActual > 1) {
        diaActual++;
        continue;
    }
    
    console.log(`--- Procesando Semana a partir del Día ${diaActual} ---`);
    
    // 2. Encontrar los días hábiles de esta semana
    const diasHabilesSemana: Date[] = [];
    let diaSemanaActual = diaActual;
    
    // Avanza hasta 5 días hábiles o fin de mes/semana
    while (diasHabilesSemana.length < 5 && diaSemanaActual <= diasDelMes) {
        const fecha = new Date(Date.UTC(anio, mes - 1, diaSemanaActual));
        const dayOfWeek = fecha.getUTCDay();

        if (dayOfWeek === 0) { // Domingo
            diaSemanaActual++;
            break; // Termina la semana
        }
        if (dayOfWeek !== 6) { // Si no es Sábado
            const esFestivo = diasFestivosDelMes.some(f => f.fecha.getTime() === fecha.getTime());
            if (!esFestivo) {
                diasHabilesSemana.push(fecha);
            }
        }
        diaSemanaActual++;
    }
    
    if (diasHabilesSemana.length === 0) {
        console.log("No hay días hábiles restantes en el mes.");
        break; // Fin del mes
    }
    
    // 3. Resetear trackers semanales
    usuariosConJusticia.forEach(u => u.asignadosEstaSemana = 0);
    let dayCounts = new Map<string, number>();
    diasHabilesSemana.forEach(d => dayCounts.set(d.toISOString(), 0));

    // 4. Ordenar usuarios por justicia (Rotación de día de la semana)
    // (b - a) = Descendente. El que tuvo HO más RECIENTE va primero
    // (para que le toque Lunes/Martes y rote)
    usuariosConJusticia.sort((a, b) => (b.ultimaHomeOfficeParaSort?.getTime() || 0) - (a.ultimaHomeOfficeParaSort?.getTime() || 0));

    // 5. Iterar por USUARIO (para asignar su(s) día(s) de la semana)
    for (const usuario of usuariosConJusticia) {
        
        let asignacionesPendientes = DIAS_HO_POR_SEMANA - usuario.asignadosEstaSemana;
        if (asignacionesPendientes <= 0) continue;

        // 6. Encontrar todos los días VÁLIDOS para este usuario
        const diasValidosConPuntaje = [];
        for (const diaHabil of diasHabilesSemana) {
            
            // Check Ausencia
            const estaAusente = ausenciasDelMes.some(
                (aus) => checkFechaEnRango(diaHabil, aus.fechaInicio, aus.fechaFin) && aus.idUsuario.equals(usuario._id)
            );
            if (estaAusente) continue;

            // Check Guardia
            const guardiaHoy = guardiasPorDia.get(diaHabil.toISOString());
            if (guardiaHoy && (guardiaHoy.idUsuarioPrincipal.equals(usuario._id) || guardiaHoy.idUsuarioApoyo.equals(usuario._id))) {
                continue; // Bloqueo por Guardia
            }

            // Check Cobertura de Sistema
            if (usuario.idSistema) {
                const idSistemaStr = usuario.idSistema.toString();
                const totalSistema = conteoSistemas[idSistemaStr] || 0;
                
                if (totalSistema <= 2 && guardiaHoy) { 
                    const principal = usuariosActivos.find(u => u._id.equals(guardiaHoy.idUsuarioPrincipal));
                    const apoyo = usuariosActivos.find(u => u._id.equals(guardiaHoy.idUsuarioApoyo));
                    let compañeroEnGuardia = false;
                    if (principal && principal.idSistema && principal.idSistema.equals(usuario.idSistema) && !principal._id.equals(usuario._id)) compañeroEnGuardia = true;
                    if (apoyo && apoyo.idSistema && apoyo.idSistema.equals(usuario.idSistema) && !apoyo._id.equals(usuario._id)) compañeroEnGuardia = true;
                    
                    if (compañeroEnGuardia) continue; // Bloqueo por Cobertura
                }
            }
            
            // Si pasó todos los filtros, es un día válido.
            // Calculamos su puntaje de "consistencia" (días más vacíos son mejores)
            const puntaje = 100 - (dayCounts.get(diaHabil.toISOString()) || 0);
            diasValidosConPuntaje.push({ fecha: diaHabil, puntaje: puntaje });
        }

        if (diasValidosConPuntaje.length === 0) {
            console.warn(`     -> ¡ADVERTENCIA! No se encontró un día válido de HO para ${usuario.nombre} esta semana.`);
            continue;
        }

        // 7. Ordenar los días válidos por el mejor puntaje (el más vacío)
        diasValidosConPuntaje.sort((a, b) => b.puntaje - a.puntaje);
        
        // 8. Asignar al mejor día (o los N mejores días si DIAS_HO_POR_SEMANA > 1)
        const diasAsignados = diasValidosConPuntaje.slice(0, asignacionesPendientes);
        
        for (const { fecha: diaAsignado } of diasAsignados) {
            const nuevoHO = new CalendarioHomeOffice({
                fecha: diaAsignado,
                idUsuario: usuario._id,
            });
            await nuevoHO.save();
            
            console.log(`     -> HO Asignado a: ${usuario.nombre} el ${diasSemana[diaAsignado.getUTCDay()]} ${diaAsignado.getUTCDate()}`);

            // 9. Actualizar trackers
            dayCounts.set(diaAsignado.toISOString(), (dayCounts.get(diaAsignado.toISOString()) || 0) + 1);
            usuario.ultimaHomeOfficeParaSort = diaAsignado; // Actualiza la justicia (para la sig. semana)
            usuario.asignadosEstaSemana++;
            
            // Actualizamos el 'ultimaHomeOffice' real en la BD
            await Usuario.updateOne({ _id: usuario._id }, { ultimaHomeOffice: diaAsignado });
        }
    }
    
    // --- LOG DE RESUMEN SEMANAL ---
    logResumenSemanal(
        `RESUMEN SEMANA (Días ${diaActual} a ${diaSemanaActual - 1})`,
        dayCounts,
        usuariosConJusticia,
        diasHabilesSemana
    );

    // Avanzamos al siguiente día a procesar
    diaActual = diaSemanaActual;

  } // --- FIN LOOP DEL MES ---
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