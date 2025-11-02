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

    static getUsuarioById = async ( req : Request, res: Response ) => {
        try {
            const { id } = req.params;

            const usuario = await Usuario.findById(id);

            
            if (!usuario) {
                return res.status(404).json({ message: 'Usuario no encontrado', data:null });
            }
            res.status(200).json({ data: usuario });

        } catch (error) {
             res.status(500).json({
                ok: false,
                message: 'Error interno del servidor.',
                error: error instanceof Error ? error.message : 'Error desconocido',
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

    static updateName = async( req: Request, res : Response ) => {
        try{
            const { id } = req.params;
            const { nombre } = req.body
            const usuario = await Usuario.findById(id);

            if (!usuario){
                return res.status(404).json({ message: 'Usuario no encontrado'});
            }

            usuario.nombre = nombre;

            await usuario.save()

            res.status(200).json({
                message:"Se actualizo exitosamente el nombre"
            })


        } catch (error){
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido' // Opcional: proveer más detalles en desarrollo
            });
        }
    }
    static updateEmail = async( req: Request, res : Response ) => {
        try{
            const { id } = req.params;
            const { email } = req.body
            const usuario = await Usuario.findById(id);

            if (!usuario){
                return res.status(404).json({ message: 'Usuario no encontrado'});
            }

            usuario.email = email;

            await usuario.save()

            res.status(200).json({
                message:"Se actualizo exitosamente el email"
            })
        } catch(error){
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido' // Opcional: proveer más detalles en desarrollo
            });
        }
    }
    static updateHO = async( req: Request, res : Response ) => {
        try{
            const { id } = req.params;
            const { ho } = req.body
            const usuario = await Usuario.findById(id);

            if (!usuario){
                return res.status(404).json({ message: 'Usuario no encontrado'});
            }

            const tieneHo = ho === 1 ? true : false

            usuario.tieneHomeOffice = tieneHo;

            await usuario.save()

            res.status(200).json({
                message:"Se actualizo exitosamente el home office"
            })
        } catch(error) {
             res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido' // Opcional: proveer más detalles en desarrollo
            });
        }
    }

    static updateCategoria = async( req: Request, res : Response ) => {
        try{
            const { id } = req.params;
            const { categoria } = req.body
            const usuario = await Usuario.findById(id);
            if (!usuario){
                return res.status(404).json({ message: 'Usuario no encontrado'});
            }
            usuario.categoria = categoria;
            await usuario.save()
            res.status(200).json({
                message:"Se actualizo exitosamente la categoria"
            })
        } catch (error){
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido' // Opcional: proveer más detalles en desarrollo
            });
        }
    }
    static updateSistema = async (req : Request, res : Response) => {
        try{
            const { id } = req.params;
            const sistema = req.body.sistema
            const usuario = await Usuario.findById(id);
            if (!usuario){
                return res.status(404).json({ message: 'Usuario no encontrado'});
            }

            if (sistema != "null") {
                const oSistema = await Sistema.findById(sistema)
                if (!oSistema){
                    return res.status(404).json({ message: 'Sistema no encontrado'});
                }
                usuario.idSistema = sistema;
            } else {
                usuario.idSistema = null;
            }
            await usuario.save();
            res.status(200).json({
                message:"Se actualizo exitosamente el sistema del usuario"
            })

        } catch(error){
            res.status(500).json({
                ok: false,
                message: 'Error interno del servidor. Por favor, contacte al administrador.',
                error: error instanceof Error ? error.message : 'Error desconocido' // Opcional: proveer más detalles en desarrollo
            });
        }
    }

}