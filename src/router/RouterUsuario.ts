import { Router } from "express";
import { ControllerUsuario } from "../controller/ControllerUsuario";
import { handleInputErrors } from "../middleware/handleInputErrors";
import { body } from "express-validator";

//. Crear router
const router = Router()

router.get("/", ControllerUsuario.getUsuarios)
router.post("/", 
    body("nombre").notEmpty().withMessage("El nombre es obligatorio"),
    body("email").isEmail().withMessage("El email debe ser válido"),
    body("categoria").isIn(["principal", "apoyo"]).withMessage("La categoría debe ser 'principal' o 'apoyo'"),
    handleInputErrors,
    ControllerUsuario.createUsuario
)

export default router