export function postText(value) {
  return String(value ?? "").replace(/locketgold\.app/gi, "locketgold.info");
}

export function postForDisplay(post) {
  return { ...post, title: postText(post.title), excerpt: postText(post.excerpt), category: postText(post.category) };
}
