import type { Request, Response } from "express"
import DiaFestivo from "../models/DiasFestivos";


export class ControllerDiaFestivo{
    static createDiaFestivo = async (req: Request, res: Response) => {
        try{
            const { nombre, fecha } = req.body;
            
            
            const yaExiste = await DiaFestivo.findOne({ fecha });
            if (yaExiste) {
                return res.status(409).json({ // 409 Conflict
                    message: `El día festivo para esta fecha ya existe: ${yaExiste.nombre}`
                });
            }

            const diaFestivo = new DiaFestivo({
                nombre,
                fecha 
            });

            await diaFestivo.save();

            res.status(201).json({ // 201 Created
                message: 'Día festivo creado exitosamente.',
                data: diaFestivo
            });
        } catch(error){
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido',
            });
        }
    }
}