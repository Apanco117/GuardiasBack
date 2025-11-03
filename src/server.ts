import express from "express"
import dotenv from "dotenv"
import { conectDB } from "./config/db";
import routerSistema from "./router/RouterSistema";
import routerUsuario from "./router/RouterUsuario";
import routerCalendario from "./router/RouterCalendario";
import routerAusencia from "./router/RouterAusencia"
import routerDiaFestivo from "./router/RouterDiaFestivo"

import cors from "cors"
import { corsConfig } from "./config/cors";

//. Variables de entorno
dotenv.config()

//. Base de datos
conectDB()
const app = express();

//. ->  Habilitar lectura de json
app.use(express.json())

//. CORS
app.use(cors(corsConfig))


app.use("/api/sistemas", routerSistema)
app.use("/api/usuarios", routerUsuario)
app.use("/api/calendario", routerCalendario)
app.use("/api/ausencia", routerAusencia)
app.use("/api/diafestivo", routerDiaFestivo)

export default app