function hash(value: any): number {
  let hash = 0,
    chr;
  if (JSON.stringify(value).length === 0) return hash;
  for (let i = 0; i < JSON.stringify(value).length; i++) {
    chr = JSON.stringify(value).charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export default hash;
