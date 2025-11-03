

import CalendarioGuardia, { CalendarioGuardiaType } from '../models/CalendarioGuardia';
import Usuario, { UsuarioType } from '../models/Usuario'; // Importamos los Types
import { AusenciaType } from '../models/Ausencia';
import CalendarioHomeOffice from '../models/HomeOffice';
import { CheckConflictoSistema, checkFechaEnRango, GetUltimoCompañero } from './AlgoritmosHelpers';

type UsuarioConJusticia = UsuarioType & {
    ultimaGuardiaParaSort: Date | null;
}

const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const algoritmoGenerarMes = async (
  mes: number,
  anio: number,
  usuariosActivos: UsuarioType[],
  ausenciasDelMes: AusenciaType[]
) => {

    const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const fechaInicioMes = new Date(Date.UTC(anio, mes - 1, 1));
    const calendarioGenerado: CalendarioGuardiaType[] = [];
    const diasSinAsignar = [];

    // Obtener ultima verdadera guardia

    const usuariosConJusticia: UsuarioConJusticia[] = await Promise.all(
        usuariosActivos.map(async (u) => {
            const ultimaGuardiaReal = await CalendarioGuardia.findOne({
                $or: [{ idUsuarioPrincipal: u._id }, { idUsuarioApoyo: u._id }],
                fecha: { $lt: fechaInicioMes }, // Antes del mes a generar
            }).sort({ fecha: -1 });

            return {
                ...u.toObject(),
                _id: u._id, 
                idSistema: u.idSistema,
                ultimaGuardiaParaSort: ultimaGuardiaReal ? ultimaGuardiaReal.fecha : null,
            };
        })
    );
    // Funcion para ordenar del mas antiguo al mas reciente
    const sortFn = (a: UsuarioConJusticia, b: UsuarioConJusticia) =>
            (a.ultimaGuardiaParaSort?.getTime() || 0) - (b.ultimaGuardiaParaSort?.getTime() || 0);

    //console.log(usuariosConJusticia)
    console.log(`--- Iniciando Generación de Mes: ${mes}/${anio} (Días: ${diasDelMes}) ---`);

    //. Iterar cada dia del mes
    for (let dia = 1; dia <= diasDelMes; dia++) {
        const fechaActual = new Date(Date.UTC(anio, mes - 1, dia));
        const diaDeLaSemana = fechaActual.getUTCDay();

        console.log(`Día ${dia} (${diasSemana[diaDeLaSemana]}) - ${diaDeLaSemana} - Valor UTC: ${diaDeLaSemana}`);

        if (diaDeLaSemana === 0 || diaDeLaSemana === 6) { // Omitir sabados y domingos
            continue; 
        }
        // Obtener usuarios que no esten ausentes
        const usuariosDisponibles = usuariosConJusticia.filter((u) => {
            return !ausenciasDelMes.some(
                (aus) =>
                checkFechaEnRango(fechaActual, aus.fechaInicio, aus.fechaFin) &&
                aus.idUsuario.equals(u._id)
            );
        });
        
        // Obtener guardias principales y de apoyo por separado
        let principales = usuariosDisponibles.filter((u) => u.categoria === 'principal');
        let apoyos = usuariosDisponibles.filter((u) => u.categoria === 'apoyo');

        // Ordenar arreglos
        principales.sort(sortFn);
        apoyos.sort(sortFn);

        // Entontrar pareja de guardias
        let parEncontrado = false;
        for (const principal of principales) {
            const idUltimoCompañero = await GetUltimoCompañero(principal._id, fechaActual); // Pendiente de revisar
            const apoyosValidos = apoyos.filter((apoyo) => !CheckConflictoSistema(principal, apoyo)); // Obtener apoyos disponibles ( diferente sistema )

            if (apoyosValidos.length === 0) {
                console.log(`     -> ¡CONFLICTO DE SISTEMA! No hay apoyos válidos para ${principal.nombre}. Probando siguiente principal...`);
                continue
            };

            let apoyoElegido: UsuarioConJusticia;
            const mejorApoyo = apoyosValidos[0];
            const segundoMejorApoyo = apoyosValidos[1];

            console.log(`G. primaria ${principal.nombre}`)
            console.log(`G. secundaria primer opcion ${mejorApoyo.nombre}`)
            console.log(`G. secundaria segunda opcion ${segundoMejorApoyo.nombre}`)

            if (
                idUltimoCompañero && // Existe ultimo compañero
                mejorApoyo._id.equals(idUltimoCompañero) && // El mejor apoyo es el ultimo compañero prevopo
                segundoMejorApoyo // Existe segundo mejor apoyo
            ) {
                apoyoElegido = segundoMejorApoyo; // Se asigna el segundo mejor apoyo
            } else {
                apoyoElegido = mejorApoyo; // Se elije el primer mejor apoyo
            }

            // Crear guardia del dia
            const nuevaGuardia = new CalendarioGuardia({
                fecha: fechaActual,
                idUsuarioPrincipal: principal._id,
                idUsuarioApoyo: apoyoElegido._id,
            });

            await nuevaGuardia.save();
            console.log(nuevaGuardia)
            calendarioGenerado.push(nuevaGuardia);
            
            // Actualizar usuarios en memoria para dias siguientes
            principal.ultimaGuardiaParaSort = fechaActual;
            apoyoElegido.ultimaGuardiaParaSort = fechaActual;

            // Ultima guardia real
            await Promise.all([
                Usuario.updateOne({ _id: principal._id }, { ultimaGuardia: fechaActual }),
                Usuario.updateOne({ _id: apoyoElegido._id }, { ultimaGuardia: fechaActual }),
            ]);
            parEncontrado = true;
            break;
        }

        if (!parEncontrado) {
            console.log(`     -> ¡FALLO DE ASIGNACIÓN! No se pudo encontrar pareja para el Día ${dia}.`); // Log fina
            diasSinAsignar.push(dia);
        }

    }

    return {calendarioGenerado, diasSinAsignar};
};

