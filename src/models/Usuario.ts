import mongoose, { Schema, Document } from "mongoose";

//. ->  Type
export type UsuarioType = Document & {
  _id: mongoose.Types.ObjectId;
  nombre: string;
  email: string;
  idSistema?: mongoose.Types.ObjectId; 
  categoria: "principal" | "apoyo";
  ultimaGuardia?: Date;
  tieneHomeOffice: boolean;
  ultimaHomeOffice?: Date;
  activo: boolean;
};

//. ->  Schema
const UsuarioSchema: Schema = new Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, 
      lowercase: true,
      trim: true,
    },
    idSistema: {
      type: Schema.Types.ObjectId,
      ref: "Sistema", 
      required: false,
    },
    categoria: {
      type: String,
      required: true,
      enum: ["principal", "apoyo"], 
    },
    ultimaGuardia: {
      type: Date,
      required: false, 
    },
    tieneHomeOffice: { 
      type: Boolean,
      required: true,
      default: false,
    },
    ultimaHomeOffice: {
      type: Date,
      required: false,
    },
    activo: {
      type: Boolean,
      required: true,
      default: true, 
    },
  },
  { timestamps: true }
);

//. ->  Model
const Usuario = mongoose.model<UsuarioType>("Usuario", UsuarioSchema);
export default Usuario;