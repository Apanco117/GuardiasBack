import mongoose from 'mongoose';

import Usuario, { UsuarioType } from '../models/Usuario';
import { AusenciaType } from '../models/Ausencia';
import CalendarioHomeOffice from '../models/HomeOffice';

const DIAS_HO_POR_SEMANA = 1;



export const algoritmoGenerarHomeOffice = async (
    mes: number,
    anio: number,
    usuariosParaHO: UsuarioType[],
    ausenciasDelMes: AusenciaType[]
) => {
    const diasDelMes = new Date(anio, mes, 0).getDate();
    
    // Copia mutable para actualizar 'ultimaHomeOffice' en memoria
    let usuarios = [...usuariosParaHO]; 
    
    // Trackea cuántos días de HO le hemos dado a cada usuario ESTA SEMANA
    // Se resetea cada Lunes.
    let asignadosEstaSemana = new Map<string, number>();

    // --- INICIA LOOP DEL MES ---
    for (let dia = 1; dia <= diasDelMes; dia++) {
        const fechaActual = new Date(anio, mes - 1, dia);
        const diaDeLaSemana = fechaActual.getDay(); // 0 = Domingo, 1 = Lunes

        // 1. Validar si es día hábil
        if (diaDeLaSemana === 0 || diaDeLaSemana === 6) {
            continue; // Saltamos fin de semana
        }
         
        // 2. Resetear el tracker semanal
        if (diaDeLaSemana === 1) { // Si es Lunes
            asignadosEstaSemana.clear();
        }
        
        // 3. Calcular "cupo" de HO para hoy
        // (Total de usuarios * días por semana) / 5 días hábiles
        // Ej: (12 usuarios * 1 día) / 5 = 2.4. Redondeamos hacia arriba.
        const cupoDiario = Math.ceil((usuarios.length * DIAS_HO_POR_SEMANA) / 5);

        // 4. Filtrar Candidatos para HO hoy
        const candidatosHO = usuarios
        .filter((u) => {
            // Regla 1: No estar ausente
            const estaAusente = ausenciasDelMes.some((aus) =>
            checkFechaEnRango(fechaActual, aus.fechaInicio, aus.fechaFin) && aus.idUsuario.equals(u._id)
            );
            // Regla 2: No haber cumplido su cuota de HO esta semana
            const cuotaSemanal = asignadosEstaSemana.get(u._id.toString()) || 0;
            
            return !estaAusente && cuotaSemanal < DIAS_HO_POR_SEMANA;
        })
        // Regla 3: Justicia (el que tenga fecha más antigua va primero)
        .sort((a, b) => (b.ultimaHomeOffice?.getTime() || 0) - (a.ultimaHomeOffice?.getTime() || 0));

        // 5. Asignar HO a los 'cupoDiario' primeros
        const asignadosHoy = candidatosHO.slice(0, cupoDiario);

        for (const usuario of asignadosHoy) {
            // 6. Guardar en BD
            const nuevoHO = new CalendarioHomeOffice({
                fecha: fechaActual,
                idUsuario: usuario._id,
            });
            await nuevoHO.save();
            
            usuario.ultimaHomeOffice = fechaActual;
            
            const idStr = usuario._id.toString();
            asignadosEstaSemana.set(idStr, (asignadosEstaSemana.get(idStr) || 0) + 1);
            
            // 8. Actualizar BD (se puede optimizar, pero es claro)
            await Usuario.updateOne({ _id: usuario._id }, { ultimaHomeOffice: fechaActual });
        }
    } // --- FIN LOOP DEL MES ---
};

const checkFechaEnRango = (check: Date, inicio: Date, fin: Date): boolean => {
    const f = new Date(check);
    const fInicio = new Date(inicio);
    const fFin = new Date(fin);
    f.setHours(0, 0, 0, 0);
    fInicio.setHours(0, 0, 0, 0);
    fFin.setHours(0, 0, 0, 0);
    return f.getTime() >= fInicio.getTime() && f.getTime() <= fFin.getTime();
};