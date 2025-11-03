import { Router } from "express";
import { handleInputErrors } from "../middleware/handleInputErrors";
import { body, param } from "express-validator";
import { ControllerDiaFestivo } from "../controller/ControllerDiaFesito";


const router = Router()
router.post("/",
    body('nombre')
        .notEmpty().withMessage('El nombre del día festivo es obligatorio.')
        .isString()
        .trim(),
    
    body('fecha')
        .notEmpty().withMessage('La fecha es obligatoria.')
        .isISO8601().withMessage('La fecha debe estar en formato YYYY-MM-DD.')
        .toDate(),
    handleInputErrors,           // 2. Middleware que maneja los errores de validación
    ControllerDiaFestivo.createDiaFestivo // 3. Controlador
);


export default router