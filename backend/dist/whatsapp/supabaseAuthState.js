"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSupabaseAuthState = void 0;
const baileys_1 = require("@whiskeysockets/baileys");
const useSupabaseAuthState = async (supabase, sessionName = 'baileys_session') => {
    // Ler do banco
    const readData = async (id) => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_auth')
                .select('data')
                .eq('id', id)
                .single();
            if (error || !data)
                return null;
            return JSON.parse(data.data, baileys_1.BufferJSON.reviver);
        }
        catch (err) {
            return null;
        }
    };
    // Salvar no banco
    const writeData = async (id, value) => {
        const jsonStr = JSON.stringify(value, baileys_1.BufferJSON.replacer);
        await supabase
            .from('whatsapp_auth')
            .upsert({ id, data: jsonStr, updated_at: new Date().toISOString() });
    };
    // Excluir do banco
    const removeData = async (id) => {
        await supabase.from('whatsapp_auth').delete().eq('id', id);
    };
    // Lê credenciais iniciais ou gera novas
    let creds = await readData(`${sessionName}_creds`);
    if (!creds) {
        creds = (0, baileys_1.initAuthCreds)();
        await writeData(`${sessionName}_creds`, creds);
    }
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${sessionName}_${type}_${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = baileys_1.proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${sessionName}_${category}_${id}`;
                            if (value) {
                                tasks.push(writeData(key, value));
                            }
                            else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            return writeData(`${sessionName}_creds`, creds);
        }
    };
};
exports.useSupabaseAuthState = useSupabaseAuthState;
