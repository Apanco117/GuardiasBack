import type { Request, Response } from "express"
import Usuario from "../models/Usuario";
import Ausencia from "../models/Ausencia";


export class ControllerAusencia {
    static getAusenciaByUsuario = async ( req: Request, res: Response ) => {
        try{
            const { idUsuario } = req.params;
            const usuario = await Usuario.findById(idUsuario)
            if (!usuario) {
                return res.status(404).json({ message: 'Usuario no encontrado'});
            }
            const ausencias = await Ausencia.find({ idUsuario: idUsuario }).sort({ fechaInicio: 'asc' }); 
            res.status(200).json({
                message: `Ausencias de ${usuario.nombre} obtenidas exitosamente.`,
                data: ausencias
            });
        } catch (error) {
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido' // Opcional: proveer más detalles en desarrollo
            });
        }
    }
    static deleteAusencia = async ( req: Request, res: Response ) => {
        try{
            const { id } = req.params;
            const ausencia = await Ausencia.findById(id);
            if(!ausencia){
                return res.status(404).json({ message: 'Ausencia no encontrada'});
            }
            await ausencia.deleteOne()
            res.status(200).json({
                message: `Ausencia eliminada exitosamente`,
            });
        } catch(error){
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido' // Opcional: proveer más detalles en desarrollo
            });
        }
    }

    static createAusencia = async ( req: Request, res: Response ) => {
        try{
            const {userId, motivo, fechaInicio, fechaFin} = req.body
            const usuario = await Usuario.findById(userId);
            if ( !usuario ) {
                return res.status(404).json({ message: 'Usuario no encontrado'});
            }
            console.log(`inicio: ${fechaInicio} fin ${fechaFin}`)
            const ausencia = new Ausencia({
                idUsuario:userId,
                motivo,
                fechaInicio,
                fechaFin
            })

            await ausencia.save();

            res.status(200).json({
                message: `Ausencia de ${usuario.nombre} creada exitosamente.`
            });

        } catch(error){
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido' // Opcional: proveer más detalles en desarrollo
            });
        }

    }

}