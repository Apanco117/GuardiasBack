import mongoose from 'mongoose';
import { AusenciaType } from '../models/Ausencia';
import Usuario, { UsuarioType } from '../models/Usuario';
import CalendarioGuardia from '../models/CalendarioGuardia';

// Verificar si la fecha pasada esta entre las fechas proporcionadas
export const checkFechaEnRango = (check: Date, inicio: Date, fin: Date): boolean => { 
    const f = new Date(check);
    const fInicio = new Date(inicio);
    const fFin = new Date(fin);
    
    f.setHours(0, 0, 0, 0);
    fInicio.setHours(0, 0, 0, 0);
    fFin.setHours(0, 0, 0, 0);
    
    return f.getTime() >= fInicio.getTime() && f.getTime() <= fFin.getTime();
};


const checkAusencia = (
    idUsuario: mongoose.Types.ObjectId,
    fecha: Date,
    ausencias: AusenciaType[]
): boolean => {
    return ausencias.some((aus) => {
        // Convertimos fechas a "medianoche" para evitar problemas de horas
        const f = new Date(fecha.setHours(0, 0, 0, 0));
        const inicio = new Date(aus.fechaInicio.setHours(0, 0, 0, 0));
        const fin = new Date(aus.fechaFin.setHours(0, 0, 0, 0));

        return aus.idUsuario.equals(idUsuario) && f >= inicio && f <= fin;
    });
};
export const CheckConflictoSistema = ( // Valida que dos usuarios no pertenezcan al mismo sistema
    u1: UsuarioType,
    u2: UsuarioType
): boolean => {
    // Si alguno no tiene sistema (desarrollador "comodín"), NO hay conflicto.
    if (!u1.idSistema || !u2.idSistema) {
        return false;
    }
    // Si ambos tienen sistema, revisamos si son iguales.
    return u1.idSistema.equals(u2.idSistema);
};

export const GetUltimoCompañero = async (
    idUsuario: mongoose.Types.ObjectId,
    fechaActual: Date 
): Promise<mongoose.Types.ObjectId | null> => {
    const ultimaGuardia = await CalendarioGuardia.findOne({
        $or: [{ idUsuarioPrincipal: idUsuario }, { idUsuarioApoyo: idUsuario }],
        fecha: { $lt: fechaActual } 
    }).sort({ fecha: -1 });

    if (!ultimaGuardia) return null;
    
    return ultimaGuardia.idUsuarioPrincipal.equals(idUsuario)
        ? ultimaGuardia.idUsuarioApoyo
        : ultimaGuardia.idUsuarioPrincipal;
};