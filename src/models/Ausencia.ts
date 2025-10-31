import mongoose, { Schema, Document } from "mongoose";

//. ->  Type
export type AusenciaType = Document & {
    _id: mongoose.Types.ObjectId;
    idUsuario: mongoose.Types.ObjectId; // Referencia a 'Usuario'
    fechaInicio: Date;
    fechaFin: Date;
    motivo?: string;
};

//. ->  Schema
const AusenciaSchema: Schema = new Schema(
    {
        idUsuario: {
        type: Schema.Types.ObjectId,
        ref: "Usuario", // Referencia al modelo 'Usuario'
        required: true,
        },
        fechaInicio: {
        type: Date,
        required: true,
        },
        fechaFin: {
        type: Date,
        required: true,
        },
        motivo: {
        type: String,
        required: false,
        },
    },
    { timestamps: true }
);

//. ->  Model
const Ausencia = mongoose.model<AusenciaType>("Ausencia", AusenciaSchema);
export default Ausencia;