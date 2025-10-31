import mongoose from "mongoose";
import colors from "colors";
import { exit } from 'node:process';

export const conectDB = async ()=>{
    const conection = await mongoose.connect(process.env.DATABASE_URL)
    try {
        const url = `${conection.connection.host}:${conection.connection.port}`
        console.log(colors.magenta.bold(`MongooDB conectado en: ${url}`))
    } catch (error) {
        console.log(colors.red.bold(`Error la conectar con la base de datos`))
        console.log(error);
        exit(1);
    }
} 