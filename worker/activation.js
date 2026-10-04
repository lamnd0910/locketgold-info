// HTTP 200 can mean the request was accepted, so require explicit completion.
// Map the provider's actual response here when its API schema is configured.
export function activationConfirmed(result) {
  if (!result || typeof result !== "object" || result.success === false) return false;
  if (result.status && result.status !== "completed") return false;
  return result.status === "completed" || result.completed === true;
}
