import type { Request, Response } from "express"
import CalendarioGuardia from "../models/CalendarioGuardia";
import Usuario from "../models/Usuario";
import Ausencia from "../models/Ausencia";
import { algoritmoGenerarMes } from "../services/AlgoritmoGuardias";
import CalendarioHomeOffice from "../models/HomeOffice";
import { algoritmoGenerarHomeOffice } from "../services/AlgoritmoHomeOffice";

export class ControllerCalendario {
    static generarCalendarioMensual = async (req: Request, res: Response) => {
        try {
            const { mes, anio } = req.body; // mes (1-12), anio (ej. 2025)

            // 1. Validación de Entrada
            if (!mes || !anio || mes < 1 || mes > 12 || anio < 2024) {
                return res.status(400).json({
                    message: 'Mes y año son requeridos y deben ser válidos.',
                });
            }

            
            const fechaInicioMes = new Date(Date.UTC(anio, mes - 1, 1));
            
            const fechaFinMes = new Date(Date.UTC(anio, mes, 0)); 

            await Promise.all([
                CalendarioGuardia.deleteMany({ fecha: { $gte: fechaInicioMes, $lte: fechaFinMes } }),
                CalendarioHomeOffice.deleteMany({ fecha: { $gte: fechaInicioMes, $lte: fechaFinMes } })
            ]);

            // 3. Obtener Datos Maestros
            // Obtenemos todos los usuarios activos y todas las ausencias de ESE MES
            const [usuariosActivos, ausenciasDelMes] = await Promise.all([
                Usuario.find({ activo: true }),
                Ausencia.find({
                $or: [
                    { fechaInicio: { $lte: fechaFinMes, $gte: fechaInicioMes } },
                    { fechaFin: { $lte: fechaFinMes, $gte: fechaInicioMes } },
                ],
                }),
            ]);

            if (usuariosActivos.length < 2) {
                return res.status(409).json({ message: 'No hay suficientes usuarios activos para generar guardias.' });
            }

            const usuariosParaHO = usuariosActivos.filter(u => u.tieneHomeOffice);
            // await algoritmoGenerarHomeOffice(
            //     mes,
            //     anio,
            //     usuariosParaHO,
            //     ausenciasDelMes
            // );

           

            
            const { calendarioGenerado, diasSinAsignar } = await algoritmoGenerarMes(
                mes,
                anio,
                usuariosActivos,
                ausenciasDelMes
            );

            // 5. Responder
            res.status(201).json({
                message: 'Calendario generado exitosamente.',
                data: calendarioGenerado,
                alertas: diasSinAsignar.length > 0 
                ? `No se pudo asignar guardia para los días: ${diasSinAsignar.join(',')}`
                : 'Todos los días hábiles fueron asignados.'
            });

        } catch (error) {
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido',
            });
        }
    };

    static getCalendarioMesGuardia = async (req: Request, res: Response) => {
        try {
            // 1. Obtenemos mes y año de los query params (ej. /api/calendario?mes=11&anio=2025)
            const { mes, anio } = req.query;
            console.log(`${mes} / ${anio}`)

            // 2. Validación de Entrada
            const mesNum = parseInt(mes as string);
            const anioNum = parseInt(anio as string);

            if (isNaN(mesNum) || isNaN(anioNum) || mesNum < 1 || mesNum > 12 || anioNum < 2024) {
                return res.status(400).json({
                message: 'Mes y año son requeridos como query parameters y deben ser válidos.',
                });
            }

            
            const fechaInicioMes = new Date(Date.UTC(anioNum, mesNum - 1, 1)); 
            const fechaFinMes = new Date(Date.UTC(anioNum, mesNum, 1));

            // 4. La consulta con POBLACIÓN (populate)
            const calendario = await CalendarioGuardia.find({
                fecha: {
                $gte: fechaInicioMes,
                $lte: fechaFinMes,
                },
            })
            .sort({ fecha: 1 }) // Ordena los días ascendentemente (del 1 al 30/31)
            .populate({
                path: 'idUsuarioPrincipal', // Pobla este campo
                select: 'nombre email categoria idSistema', // Trae solo estos campos del usuario
                populate: {
                path: 'idSistema', // ¡Población Anidada!
                select: 'nombre',    // Trae solo el nombre del sistema
                model: 'Sistema'     // (Opcional, pero buena práctica)
                }
            })
            .populate({
                path: 'idUsuarioApoyo', // Repetimos para el usuario de apoyo
                select: 'nombre email categoria idSistema',
                populate: {
                path: 'idSistema',
                select: 'nombre',
                model: 'Sistema'
                }
            });
            
            // 5. Enviar la respuesta
            res.status(200).json({
                message: 'Calendario obtenido exitosamente',
                data: calendario,
            });

        } catch (error) {
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido',
            });
        }
    };

    static getCalendarioMesHome = async (req: Request, res: Response) => {
        try {
            const { mes, anio } = req.query;

            // 2. Validación de Entrada
            const mesNum = parseInt(mes as string);
            const anioNum = parseInt(anio as string);

            if (isNaN(mesNum) || isNaN(anioNum) || mesNum < 1 || mesNum > 12 || anioNum < 2024) {
                return res.status(400).json({
                message: 'Mes y año son requeridos como query parameters y deben ser válidos.',
                });
            }
            const fechaInicioMes = new Date(anioNum, mesNum - 1, 1);
            const fechaFinMes = new Date(anioNum, mesNum, 0); // Día 0 del sig. mes = último día del mes actual

            // 4. La consulta con POBLACIÓN (populate)
            const calendarioHO = await CalendarioHomeOffice.find({
                fecha: {
                $gte: fechaInicioMes,
                $lte: fechaFinMes,
                },
            })
            .sort({ fecha: 1 }) // Ordena los días ascendentemente
            .populate({
                path: 'idUsuario', // El campo a poblar
                select: 'nombre email categoria', // Trae solo estos campos del usuario
                model: 'Usuario' // Especifica el modelo a usar
            });
            
            // 5. Enviar la respuesta
            res.status(200).json({
                message: 'Calendario de Home Office obtenido exitosamente',
                data: calendarioHO,
            });
        } catch (error) {
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido',
            });
        }
    }

    static getAllMonths = async ( req : Request, res: Response ) => {
        try{
            const mesesGenerados = await CalendarioGuardia.aggregate([
                {
                    // 2. Agrupamos todos los documentos por una ID compuesta
                    //    extrayendo el año y el mes del campo 'fecha'
                    $group: {
                        _id: {
                            year: { $year: "$fecha" },
                            month: { $month: "$fecha" }
                        }
                    }
                },
                {
                    // 3. Ordenamos los resultados cronológicamente
                    $sort: {
                        "_id.year": 1,  // 1 = ascendente
                        "_id.month": 1
                    }
                },
                {
                    // 4. (Opcional) Reformateamos la salida para que sea un
                    //    array de objetos { year: YYYY, month: MM }
                    $project: {
                        year: "$_id.year",
                        month: "$_id.month",
                        _id: 0 // Ocultamos el campo '_id'
                    }
                }
            ]);

            // 5. Manejamos el caso de que no haya nada generado
            if (mesesGenerados.length === 0) {
                return res.status(200).json({
                    message: 'No hay calendarios generados.',
                    data: []
                });
            }

            // 6. Enviamos la lista de meses
            res.status(200).json({
                message: 'Meses generados obtenidos exitosamente.',
                data: mesesGenerados
            });
        } catch ( error ) {
             res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido',
            });
        }
    }

    static deleteMonth = async ( req : Request, res: Response ) => {
        try{
            const { mes, anio } = req.query;

            console.log(`${mes}/${anio}`)

            const mesNum = parseInt(mes as string);
                const anioNum = parseInt(anio as string);

                if (isNaN(mesNum) || isNaN(anioNum) || mesNum < 1 || mesNum > 12 || anioNum < 2024) {
                    return res.status(400).json({
                        message: 'Mes y año son requeridos como query parameters y deben ser válidos.',
                    });
                }
                
                const fechaInicioMes = new Date(Date.UTC(anioNum, mesNum - 1, 1));
                const fechaFinMes = new Date(Date.UTC(anioNum, mesNum, 0));
                console.log(fechaInicioMes)
                console.log(fechaFinMes)

                
                const filtroFecha = {
                    fecha: {
                        $gte: fechaInicioMes,
                        $lte: fechaFinMes,
                    },
                };

                // 5. Ejecutar ambas eliminaciones en paralelo
                const [
                    resultadoGuardias, 
                    resultadoHomeOffice
                ] = await Promise.all([
                    CalendarioGuardia.deleteMany(filtroFecha),
                    CalendarioHomeOffice.deleteMany(filtroFecha)
                ]);
                
                // 6. Enviar respuesta exitosa
                res.status(200).json({
                    message: `Calendarios para ${mesNum}/${anioNum} eliminados exitosamente.`,
                    data: {
                        guardiasEliminadas: resultadoGuardias.deletedCount,
                        homeOfficeEliminados: resultadoHomeOffice.deletedCount
                    }
                });
        } catch (error) {
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido',
            });
        }
    }
}