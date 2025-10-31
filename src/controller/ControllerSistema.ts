import type { Request, Response } from "express"
import Sistema from "../models/Sistema";


export class ControllerSistema {
    static createSistema = async ( req: Request, res: Response ) => {
        try{

            const nombre = req.body.nombre;
            const descripcion = req.body.descripcion;
            const sistema = new Sistema({ nombre, descripcion });
            await sistema.save();

            res.status(201).json({
                message: 'Sistema creado exitosamente',
                data: sistema
            });
            


        } catch (error) {
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido' // Opcional: proveer más detalles en desarrollo
            });
        }
    }

    static getSistemas = async ( req: Request, res: Response ) => {
        try{
            const sistemas = await Sistema.find();
            res.status(200).json({
                message: 'Sistemas obtenidos exitosamente',
                data: sistemas
            });
        } catch (error) {
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido' // Opcional: proveer más detalles en desarrollo
            });
        }
    }

}