

import mongoose from 'mongoose';
import CalendarioGuardia from '../models/CalendarioGuardia';
import Usuario, { UsuarioType } from '../models/Usuario'; // Importamos los Types
import { AusenciaType } from '../models/Ausencia';
import CalendarioHomeOffice from '../models/HomeOffice';

/**
 * --- FUNCIÓN PRINCIPAL DEL ALGORITMO ---
 * Itera por un mes y asigna las guardias.
 */

export const algoritmoGenerarMes = async (
  mes: number,
  anio: number,
  usuariosActivos: UsuarioType[],
  ausenciasDelMes: AusenciaType[]
) => {
    const diasDelMes = new Date(anio, mes, 0).getDate();
    const calendarioGenerado = [];
    const diasSinAsignar = [];

    const fechaInicioMes = new Date(anio, mes - 1, 1);
    const fechaFinMes = new Date(anio, mes, 0);

    // 1. Obtener datos maestros (HO, Conteos)
    const homeOfficesDelMes = await CalendarioHomeOffice.find({
        fecha: { $gte: fechaInicioMes, $lte: fechaFinMes },
    });

    const conteoSistemas: { [key: string]: number } = {};
    for (const u of usuariosActivos) {
        if (u.idSistema) {
            const idSistemaStr = u.idSistema.toString();
            conteoSistemas[idSistemaStr] = (conteoSistemas[idSistemaStr] || 0) + 1;
        }
    }

    let usuariosParaAsignar = [...usuariosActivos];

    // --- INICIA LOOP DEL MES ---
    for (let dia = 1; dia <= diasDelMes; dia++) {
        console.log(`Asignando guardias para el día ${dia}/${mes}/${anio}...`);
        // CAMBIO 1: Definir la fecha y el día de la semana PRIMERO
        const fechaActual = new Date(anio, mes - 1, dia);
        const diaDeLaSemana = fechaActual.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado

        // CAMBIO 2: Validar fin de semana ANTES de cualquier lógica
        if (diaDeLaSemana === 0 || diaDeLaSemana === 6) {
            continue; // Saltamos fin de semana
        }

        // --- Lógica de Home Office y Ausencias (AHORA SÍ) ---
        const usuariosEnHO = homeOfficesDelMes
            .filter((ho) => ho.fecha.getDate() === dia)
            .map((ho) => ho.idUsuario);

        // Ahora 'fechaActual' SÍ existe y puede usarse aquí
        const usuariosAusentes = ausenciasDelMes
            .filter((aus) => checkFechaEnRango(fechaActual, aus.fechaInicio, aus.fechaFin))
            .map((aus) => aus.idUsuario);

        // 2.B. Filtrar usuarios disponibles para GUARDIA (Regla 1: No HO, No Ausencia)
        const usuariosDisponiblesGuardia = usuariosParaAsignar.filter((u) => {
        const estaAusente = usuariosAusentes.some((id) => id.equals(u._id));
        const estaEnHO = usuariosEnHO.some((id) => id.equals(u._id));
            return !estaAusente && !estaEnHO;
        });

        // 2.C. Filtrar candidatos por Cobertura (Regla 2: Sistemas de 2 personas)
        const usuariosCandidatos = usuariosDisponiblesGuardia.filter((usuario) => {
            if (!usuario.idSistema) return true; // Comodín siempre es candidato

            const idSistemaStr = usuario.idSistema.toString();
            const totalSistema = conteoSistemas[idSistemaStr] || 0;

            if (totalSistema >= 3) return true; // Sistema grande siempre es candidato

            // Lógica para sistemas de 2 o menos personas
            const hoSistema = usuariosActivos.filter(
                (u) =>
                u.idSistema &&
                u.idSistema.equals(usuario.idSistema!) &&
                usuariosEnHO.some((id) => id.equals(u._id))
            ).length;

            return (totalSistema - hoSistema) >= 2;
        });

        // 3. Obtener listas finales de Principales y Apoyos para HOY
        let principales = usuariosCandidatos.filter((u) => u.categoria === 'principal');
        let apoyos = usuariosCandidatos.filter((u) => u.categoria === 'apoyo');

        // --- FIN Lógica Home Office ---
        
        // CAMBIO 3: ELIMINAR el bloque de filtrado antiguo.
        // El bloque "const usuariosDisponibles = ..." que tenías aquí
        // es incorrecto y obsoleto. Tus listas 'principales' y 'apoyos'
        // ya están filtradas correctamente.

        // 4. Ordenar por "Justicia" (última guardia más antigua primero)
        const sortFn = (a: UsuarioType, b: UsuarioType) =>
        (a.ultimaGuardia?.getTime() || 0) - (b.ultimaGuardia?.getTime() || 0);

        principales.sort(sortFn);
        apoyos.sort(sortFn);

        // 5. Lógica de Búsqueda de Pareja (Esta parte estaba bien)
        let parEncontrado = false;
        for (const principal of principales) {
        
        const idUltimoCompañero = await GetUltimoCompañero(principal._id);

        const apoyosValidos = apoyos.filter(
            (apoyo) => !CheckConflictoSistema(principal, apoyo)
        );

        if (apoyosValidos.length === 0) continue; 

        const mejorApoyo = apoyosValidos[0];
        const segundoMejorApoyo = apoyosValidos[1]; 
        let apoyoElegido: UsuarioType;

        if (
            idUltimoCompañero &&
            mejorApoyo._id.equals(idUltimoCompañero) &&
            segundoMejorApoyo
        ) {
            apoyoElegido = segundoMejorApoyo;
        } else {
            apoyoElegido = mejorApoyo;
        }

        // 6. ¡Asignación!
        const nuevaGuardia = new CalendarioGuardia({
            fecha: fechaActual,
            idUsuarioPrincipal: principal._id,
            idUsuarioApoyo: apoyoElegido._id,
        });

        await nuevaGuardia.save();
        calendarioGenerado.push(nuevaGuardia);

        // 7. Actualizar 'ultimaGuardia' en el array local y BD
        principal.ultimaGuardia = fechaActual;
        apoyoElegido.ultimaGuardia = fechaActual;

        await Promise.all([
            Usuario.updateOne({ _id: principal._id }, { ultimaGuardia: fechaActual }),
            Usuario.updateOne({ _id: apoyoElegido._id }, { ultimaGuardia: fechaActual }),
        ]);

        parEncontrado = true;
        break; 
        }

        if (!parEncontrado) {
        diasSinAsignar.push(dia);
        }
    } 

    return { calendarioGenerado, diasSinAsignar };
};

const checkFechaEnRango = (check: Date, inicio: Date, fin: Date): boolean => {
    // Creamos copias para no mutar (modificar) las fechas originales
    // que vienen del array de ausencias o del loop del calendario.
    const f = new Date(check);
    const fInicio = new Date(inicio);
    const fFin = new Date(fin);

    // Normalizamos las tres fechas a la medianoche de su respectivo día
    f.setHours(0, 0, 0, 0);
    fInicio.setHours(0, 0, 0, 0);
    fFin.setHours(0, 0, 0, 0);

    // Comparamos los timestamps (número de milisegundos)
    // Devuelve true si la fecha 'f' es >= inicio Y <= fin
    return f.getTime() >= fInicio.getTime() && f.getTime() <= fFin.getTime();
};


const checkAusencia = (
    idUsuario: mongoose.Types.ObjectId,
    fecha: Date,
    ausencias: AusenciaType[]
): boolean => {
    return ausencias.some((aus) => {
        // Convertimos fechas a "medianoche" para evitar problemas de horas
        const f = new Date(fecha.setHours(0, 0, 0, 0));
        const inicio = new Date(aus.fechaInicio.setHours(0, 0, 0, 0));
        const fin = new Date(aus.fechaFin.setHours(0, 0, 0, 0));

        return aus.idUsuario.equals(idUsuario) && f >= inicio && f <= fin;
    });
};
export const CheckConflictoSistema = (
    u1: UsuarioType,
    u2: UsuarioType
): boolean => {
    // Si alguno no tiene sistema (desarrollador "comodín"), NO hay conflicto.
    if (!u1.idSistema || !u2.idSistema) {
        return false;
    }
    // Si ambos tienen sistema, revisamos si son iguales.
    return u1.idSistema.equals(u2.idSistema);
};

export const GetUltimoCompañero = async (
    idUsuario: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId | null> => {
    const ultimaGuardia = await CalendarioGuardia.findOne({
        $or: [{ idUsuarioPrincipal: idUsuario }, { idUsuarioApoyo: idUsuario }],
    }).sort({ fecha: -1 });

    if (!ultimaGuardia) return null;

    // Devolvemos el ID del "otro"
    return ultimaGuardia.idUsuarioPrincipal.equals(idUsuario)
        ? ultimaGuardia.idUsuarioApoyo
        : ultimaGuardia.idUsuarioPrincipal;
};