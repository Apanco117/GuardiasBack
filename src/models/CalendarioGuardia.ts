import mongoose, { Schema, Document } from "mongoose";

//. ->  Type
export type CalendarioGuardiaType = Document & {
    _id: mongoose.Types.ObjectId;
    fecha: Date;
    idUsuarioPrincipal: mongoose.Types.ObjectId;
    idUsuarioApoyo: mongoose.Types.ObjectId;
};

//. ->  Schema
const CalendarioGuardiaSchema: Schema = new Schema(
    {
        fecha: {
        type: Date,
        required: true,
        unique: true, 
        },
        idUsuarioPrincipal: {
        type: Schema.Types.ObjectId,
        ref: "Usuario",
        required: true,
        },
        idUsuarioApoyo: {
        type: Schema.Types.ObjectId,
        ref: "Usuario",
        required: true,
        },
    },
    { timestamps: true }
);

//. ->  Model
const CalendarioGuardia = mongoose.model<CalendarioGuardiaType>(
    "CalendarioGuardia",
    CalendarioGuardiaSchema
);

export default CalendarioGuardia;