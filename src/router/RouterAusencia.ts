import { Router } from "express";
import { handleInputErrors } from "../middleware/handleInputErrors";
import { body, param } from "express-validator";
import { ControllerAusencia } from "../controller/ControllerAusencia";


const router = Router()

router.get("/:idUsuario",
    param('idUsuario').isMongoId().withMessage('El ID del usuario no es un MongoID válido.'),
    handleInputErrors,
    ControllerAusencia.getAusenciaByUsuario
)

router.delete("/:id",
    param('id').isMongoId().withMessage('El ID de la ausencia no es un MongoID válido.'),
    handleInputErrors,
    ControllerAusencia.deleteAusencia
)

router.post("/",
     body("userId")
        .isMongoId().withMessage('El ID del usuario no es un MongoID válido.'),
    
    body("motivo")
        .notEmpty().withMessage('El motivo no puede ir vacío.')
        .isString().withMessage('El motivo debe ser texto.'),
    
    body("fechaInicio")
        .isISO8601().withMessage('La fecha de inicio debe ser una fecha válida (YYYY-MM-DD).'),
    
    body("fechaFin")
        .isISO8601().withMessage('La fecha de fin debe ser una fecha válida (YYYY-MM-DD).')
        // Añadimos una validación personalizada para comparar las fechas
        .custom((value, { req }) => {
            if (new Date(value) < new Date(req.body.fechaInicio)) {
                throw new Error('La fecha de fin no puede ser anterior a la fecha de inicio.');
            }
            return true; // Si la validación pasa
        }),
    handleInputErrors,
    ControllerAusencia.createAusencia
)


export default router