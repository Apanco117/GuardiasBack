import express from "express"
import dotenv from "dotenv"
import { conectDB } from "./config/db";
import routerSistema from "./router/RouterSistema";
import routerUsuario from "./router/RouterUsuario";
import routerCalendario from "./router/RouterCalendario";

//. Variables de entorno
dotenv.config()

//. Base de datos
conectDB()
const app = express();

//. ->  Habilitar lectura de json
app.use(express.json())


app.use("/api/sistemas", routerSistema)
app.use("/api/usuarios", routerUsuario)
app.use("/api/calendario", routerCalendario)

export default app