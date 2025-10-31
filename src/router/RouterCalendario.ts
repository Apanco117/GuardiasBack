import { Router } from "express";
import { ControllerCalendario } from "../controller/ControllerCalendario";
import { handleInputErrors } from "../middleware/handleInputErrors";
import { body } from "express-validator";

//. ->  Crear router
const router = Router()


router.post('/generar-calendario-mensual', 
    body("mes").isInt({ min: 1, max: 12 }).withMessage("El mes debe ser un número entre 1 y 12."),
    body("anio").isInt({ min: 2024 }).withMessage("El año debe ser un número válido (mínimo 2024)."),
    handleInputErrors,
    ControllerCalendario.generarCalendarioMensual
)

router.get('/obtener-calendario-mensual-guardia', 
    
    handleInputErrors,
    ControllerCalendario.getCalendarioMesGuardia
)

router.get('/obtener-calendario-mensual-home-office', 

    handleInputErrors,
    ControllerCalendario.getCalendarioMesHome
)

export default router;