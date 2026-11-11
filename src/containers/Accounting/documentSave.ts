import { acc } from './accountingApi';

// No answer from the server (the connection dropped, or the hosting cut a request running over its
// 30 seconds): the operation may still be saved, in full, a moment later
export const noAnswer = (error: any) => !error?.response || [502, 503, 504].includes(error.response.status);

const UNKNOWN = 'لم يصل رد من الخادم ولم تظهر العملية بعد. لا تُعد إدخالها من جديد: تأكد أولًا من القائمة إن كانت سُجّلت، وإن لم تجدها اضغط الترحيل مرة أخرى من هذه الصفحة نفسها (لن تتكرر).';

// Creates a document that carries an idempotencyKey. When no answer comes back, the page waits and
// asks whether the document was saved, instead of reporting an error for an operation that
// succeeded. Resolves with the saved document; rejects when it is still not there after the wait.
export const createDocument = async (kind: string, body: any, onWaiting?: () => void, rounds = 18, pause = 5000) => {
  try {
    return (await acc.post(kind, body)).data;
  } catch (error: any) {
    if (!noAnswer(error) || !body?.idempotencyKey) throw error;
    onWaiting?.();
    for (let attempt = 0; attempt < rounds; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, pause));
      try {
        const found = (await acc.get(kind, { idempotencyKey: body.idempotencyKey, status: 'all' })).data?.results
          ?.find((doc: any) => doc.idempotencyKey === body.idempotencyKey);
        if (found) return found;
      } catch { /* asked again on the next round */ }
    }
    // eslint-disable-next-line no-throw-literal
    throw { unknownOutcome: true, response: { data: { message: UNKNOWN } } };
  }
};
