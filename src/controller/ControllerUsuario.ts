import type { Request, Response } from "express"
import Usuario from "../models/Usuario";
import Sistema from "../models/Sistema";

export class ControllerUsuario {
    static getUsuarios = async ( req: Request, res: Response ) => {
        try{
            const usuarios = await Usuario.find();
            res.status(200).json({
                message: 'Usuarios obtenidos exitosamente',
                data: usuarios
            });
        } catch (error) {
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido' // Opcional: proveer más detalles en desarrollo
            });
        }
    }

    static createUsuario = async ( req: Request, res: Response ) => {
        try{
            const { nombre, email, idSistema, categoria } = req.body;

            let id_sistema = null;

            if (idSistema){
                const sistema = await Sistema.findById(idSistema);
                if (!sistema) {
                    res.status(400).json({
                        ok: false,
                        message: 'El sistema proporcionado no existe.'
                    });
                    return
                }
                id_sistema = sistema._id;
            }
            const usuario = new Usuario({ nombre, email, idSistema: id_sistema, categoria });
            await usuario.save();
            res.status(201).json({
                message: 'Usuario creado exitosamente',
                data: usuario
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