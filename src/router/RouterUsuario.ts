import { Router } from "express";
import { ControllerUsuario } from "../controller/ControllerUsuario";
import { handleInputErrors } from "../middleware/handleInputErrors";
import { body, param } from "express-validator";

//. Crear router
const router = Router()
 
router.get("/", ControllerUsuario.getUsuarios)

router.get("/:id",
    param('id').isMongoId().withMessage('El ID del usuario no es un MongoID válido.'),
    handleInputErrors,
    ControllerUsuario.getUsuarioById
)

router.post("/", 
    body("nombre").notEmpty().withMessage("El nombre es obligatorio"),
    body("email").isEmail().withMessage("El email debe ser válido"),
    body("categoria").isIn(["principal", "apoyo"]).withMessage("La categoría debe ser 'principal' o 'apoyo'"),
    handleInputErrors,
    ControllerUsuario.createUsuario
)

router.patch("/nombre/:id",
    param('id').isMongoId().withMessage('El ID del usuario no es un MongoID válido.'),
    body("nombre").notEmpty().withMessage("El nombre es obligatorio"),
    handleInputErrors,
    ControllerUsuario.updateName
)
router.patch("/email/:id",
    param('id').isMongoId().withMessage('El ID del usuario no es un MongoID válido.'),
    body("email").notEmpty().withMessage("El email es obligatorio").isEmail().withMessage("Ingrese un email valido"),
    handleInputErrors,
    ControllerUsuario.updateEmail
)
router.patch("/ho/:id",
    param('id').isMongoId().withMessage('El ID del usuario no es un MongoID válido.'),
    body("ho").notEmpty().withMessage("El ho es obligatorio").isNumeric().withMessage("El ho debe ser un valor numerico"),
    handleInputErrors,
    ControllerUsuario.updateHO
)
router.patch("/categoria/:id",
    param('id').isMongoId().withMessage('El ID del usuario no es un MongoID válido.'),
    body("categoria").isIn(["principal", "apoyo"]).withMessage("La categoría debe ser 'principal' o 'apoyo'"),
    handleInputErrors,
    ControllerUsuario.updateCategoria
)
router.patch("/sistema/:id",
    param('id').isMongoId().withMessage('El ID del usuario no es un MongoID válido.'),
    body("sistema").notEmpty().withMessage("El sistema es obligatorio"),
    handleInputErrors,
    ControllerUsuario.updateSistema
)
router.get("/desactivar/:id",
    param('id').isMongoId().withMessage('El ID del usuario no es un MongoID válido.'),
    body("activo").notEmpty().withMessage("El estado activo es obligatorio").isBoolean().withMessage("El estado activo debe ser un valor booleano"),
    handleInputErrors,
    ControllerUsuario.desactivarUsuarioGuardia
)

export default router