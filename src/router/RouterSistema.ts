import { Router } from "express";
import { ControllerSistema } from "../controller/ControllerSistema";
import { body } from "express-validator";
import { handleInputErrors } from "../middleware/handleInputErrors";

//. ->  Crear router
const router = Router()


router.get("/", ControllerSistema.getSistemas)

router.post("/", 
    body("nombre").notEmpty().withMessage("El nombre es obligatorio"),
    body("descripcion").notEmpty().withMessage("La descripcion es obligatoria"),
    handleInputErrors,
    ControllerSistema.createSistema
)


export default router