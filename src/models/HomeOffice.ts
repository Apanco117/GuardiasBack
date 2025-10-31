import mongoose, { Schema, Document } from "mongoose";

//. ->  Type
export type CalendarioHomeOfficeType = Document & {
    _id: mongoose.Types.ObjectId;
    fecha: Date;
    idUsuario: mongoose.Types.ObjectId; // Ref a 'Usuario'
};

//. ->  Schema
const CalendarioHomeOfficeSchema: Schema = new Schema(
    {
        fecha: {
            type: Date,
            required: true,
        },
        idUsuario: {
            type: Schema.Types.ObjectId,
            ref: "Usuario",
            required: true,
        },
    },
    {
        timestamps: true,
        unique: ["fecha", "idUsuario"],
    }
);

//. ->  Model
const CalendarioHomeOffice = mongoose.model<CalendarioHomeOfficeType>(
    "CalendarioHomeOffice",
    CalendarioHomeOfficeSchema
);

export default CalendarioHomeOffice;