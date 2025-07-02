// Agape Worship App - API: Repertoire Module

import { db } from '../../../firebase-config.js';
import {
    collection, getDocs, onSnapshot, query, updateDoc, deleteDoc, setDoc, doc, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import * as state from '../../../state.js';

const vocalistsCollection = collection(db, "vocalists");

/** Загрузка списка вокалистов */
async function loadVocalists() {
    console.log("Загрузка списка вокалистов...");
    const querySnapshot = await getDocs(vocalistsCollection);
    const vocalists = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Список вокалистов успешно загружен.");
    return vocalists;
}

/** Загрузка репертуара вокалиста с использованием callback для обновления UI */
function loadRepertoire(vocalistId, onRepertoireUpdate) {
    if (state.currentRepertoireUnsubscribe) {
        state.currentRepertoireUnsubscribe();
    }
    if (!vocalistId) {
        onRepertoireUpdate({ data: [], error: null });
        return;
    }
    const repertoireColRef = collection(db, "vocalists", vocalistId, "repertoire");
    const q = query(repertoireColRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (vocalistId !== state.currentVocalistId) return;
        const songsData = snapshot.docs.map(doc => ({ ...doc.data(), repertoireDocId: doc.id }));
        onRepertoireUpdate({ data: songsData, error: null });
    }, (error) => {
        console.error(`!!! ОШИБКА Firestore onSnapshot для репертуара ${vocalistId}:`, error);
        onRepertoireUpdate({ data: [], error });
    });
    state.setCurrentRepertoireUnsubscribe(unsubscribe);
}

/**
 * Добавляет или обновляет песню в репертуаре вокалиста.
 * Проверяет наличие по имени песни, чтобы избежать дубликатов.
 * @param {string} vocalistId
 * @param {object} song - Объект песни.
 * @param {string} preferredKey - Выбранная тональность.
 * @returns {Promise<{status: string, key: string}>}
 */
async function addToRepertoire(vocalistId, song, preferredKey) {
    const repertoireCol = collection(db, 'vocalists', vocalistId, 'repertoire');
    const q = query(repertoireCol, where("name", "==", song.name));

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        // Песня найдена, проверяем тональность
        const repertoireDoc = querySnapshot.docs[0];
        if (repertoireDoc.data().preferredKey !== preferredKey) {
            // Обновляем тональность
            await updateDoc(repertoireDoc.ref, { preferredKey: preferredKey });
            return { status: 'updated', key: preferredKey };
        } else {
            return { status: 'exists', key: preferredKey };
        }
    } else {
        // Песня не найдена, добавляем новую
        // ID документа = ID песни для консистентности
        const docRef = doc(db, 'vocalists', vocalistId, 'repertoire', song.id);
        await setDoc(docRef, {
            name: song.name,
            sheet: song.sheet,
            preferredKey: preferredKey,
            addedAt: serverTimestamp()
        });
        return { status: 'added', key: preferredKey };
    }
}

/** Удаление песни из репертуара вокалиста */
async function removeFromRepertoire(vocalistId, repertoireDocId) {
    if (!vocalistId || !repertoireDocId) return;
    const docRef = doc(db, 'vocalists', vocalistId, 'repertoire', repertoireDocId);
    await deleteDoc(docRef);
}

export {
    loadVocalists,
    loadRepertoire,
    addToRepertoire,
    removeFromRepertoire
}; 