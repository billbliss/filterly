// lib/graphMessages.ts
import { graphClient } from "./graph.js";

type GraphClient = Awaited<ReturnType<typeof graphClient>>;

export async function fetchMessageDetails(
  client: GraphClient,
  root: string,
  messageId: string,
) {
  const encodedId = encodeURIComponent(messageId);
  const path = `${root}/messages/${encodedId}`;
  return client
    .api(path)
    .select(
      [
        "id",
        "subject",
        "bodyPreview",
        "body",
        "from",
        "replyTo",
        "internetMessageHeaders",
        "receivedDateTime",
        "internetMessageId",
        "inferenceClassification",
        "categories",
        "conversationId",
        "parentFolderId",
      ].join(","),
    )
    .expand("attachments($select=id,name,contentType)")
    .header("Prefer", 'outlook.body-content-type="html"')
    .get();
}
