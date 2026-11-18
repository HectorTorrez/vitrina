export async function uploadImage(file: File): Promise<string | undefined> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    throw new Error("Usá una imagen JPG, PNG, WebP o GIF.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("La imagen supera los 5 MB. Probá con una más liviana.");
  }
  const response = await fetch("/subir", { method: "POST", body: file });
  if (response.status === 401) {
    window.location.assign("/ingresar");
    return;
  }
  if (!response.ok) throw new Error((await response.text()).trim() || "No se pudo subir la imagen");
  return (await response.json()).url;
}
