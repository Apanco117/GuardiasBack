import mongoose, { Schema, Document } from "mongoose";

//. ->  Type
export type DiaFestivoType = Document & {
    nombre: string;
    fecha: Date;
};

//. ->  Schema
const DiaFestivoSchema: Schema = new Schema(
    {
        nombre: {
            type: String,
            required: true,
            trim: true,
        },
        fecha: {
            type: Date,
            required: true,
            unique: true,
        },
    },
    { timestamps: true }
);

//. ->  Model
const DiaFestivo = mongoose.model<DiaFestivoType>(
    "DiaFestivo",
    DiaFestivoSchema
);
export default DiaFestivo;