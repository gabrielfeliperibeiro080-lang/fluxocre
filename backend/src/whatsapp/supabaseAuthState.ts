import { initAuthCreds, BufferJSON, proto, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { SupabaseClient } from '@supabase/supabase-js';

export const useSupabaseAuthState = async (supabase: SupabaseClient, sessionName: string = 'baileys_session') => {
    
    // Ler do banco
    const readData = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_auth')
                .select('data')
                .eq('id', id)
                .single();
                
            if (error || !data) return null;
            return JSON.parse(data.data, BufferJSON.reviver);
        } catch (err) {
            return null;
        }
    };

    // Salvar no banco
    const writeData = async (id: string, value: any) => {
        const jsonStr = JSON.stringify(value, BufferJSON.replacer);
        await supabase
            .from('whatsapp_auth')
            .upsert({ id, data: jsonStr, updated_at: new Date().toISOString() });
    };

    // Excluir do banco
    const removeData = async (id: string) => {
        await supabase.from('whatsapp_auth').delete().eq('id', id);
    };

    // Lê credenciais iniciais ou gera novas
    let creds = await readData(`${sessionName}_creds`);
    if (!creds) {
        creds = initAuthCreds();
        await writeData(`${sessionName}_creds`, creds);
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type: string, ids: string[]) => {
                    const data: { [_: string]: any } = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${sessionName}_${type}_${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data: any) => {
                    const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${sessionName}_${category}_${id}`;
                            if (value) {
                                tasks.push(writeData(key, value));
                            } else {
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
