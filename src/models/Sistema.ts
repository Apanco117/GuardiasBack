import mongoose, { Schema, Document } from "mongoose";


//. ->  Type
export type SistemaType = Document & {
    _id: mongoose.Types.ObjectId;
    nombre: string;
    descripcion?: string; // El '?' indica que es opcional
};

//. ->  Schema
const SistemaSchema: Schema = new Schema(
    {
        nombre: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        },
        descripcion: {
        type: String,
        required: false,
        trim: true,
        },
    },
    { timestamps: true } 
);

//. ->  Model
const Sistema = mongoose.model<SistemaType>("Sistema", SistemaSchema);
export default Sistema;