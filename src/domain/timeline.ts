import type { Animation, Project } from "./project";

export const animationLabels = {
  create: "Desenhar · Create", write: "Escrever · Write", fadeIn: "Entrada · FadeIn",
  fadeOut: "Saída · FadeOut", moveTo: "Mover · MoveTo", transform: "Transformar · Transform", parallel: "Grupo paralelo",
} satisfies Record<Animation["kind"], string>;
export const isEntrance = (kind: Animation["kind"]) => ["create", "write", "fadeIn"].includes(kind);
export const frameAt = (milliseconds: number) => Math.floor(milliseconds * 15 / 1000 + 0.5);
export const childrenOf = (clip: Animation): Animation[] => clip.kind === "parallel" ? clip.clips ?? [] : [clip];
export const leafClips = (scene: Project["scene"]) => (scene.animations ?? []).flatMap(childrenOf);
export const seconds = (ms: number) => (ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " s";

export function lifetimes(scene: Project["scene"]): Record<string, [number, number]> {
  const spans = Object.fromEntries(Object.entries(scene.elements).map(([id, element]) =>
    [id, [element.appearsAtMs, element.disappearsAtMs ?? scene.durationMs] as [number, number]]));
  for (const clip of leafClips(scene)) {
    const end = clip.startMs + clip.durationMs;
    if (clip.kind === "transform" && spans[clip.destinationId!]) spans[clip.destinationId!][0] = end;
    if (["fadeOut", "transform"].includes(clip.kind) && spans[clip.targetId!])
      spans[clip.targetId!][1] = Math.min(spans[clip.targetId!][1], end);
  }
  return spans;
}

export function validateTimeline(scene: Project["scene"]): string | null {
  if (frameAt(scene.durationMs) < 1) return "A cena precisa ocupar pelo menos um frame.";
  const owners = new Map<string, Animation>();
  for (const clip of leafClips(scene)) {
    if (clip.kind !== "transform") continue;
    if (!clip.destinationId || !scene.elements[clip.destinationId] || clip.destinationId === clip.targetId)
      return "Transform precisa de um destino diferente e existente.";
    if (owners.has(clip.destinationId)) return "Cada destino de Transform pertence a uma única transformação.";
    owners.set(clip.destinationId, clip);
  }
  const available = new Map(Object.entries(scene.elements).filter(([id]) => !owners.has(id)).map(([id, item]) => [id, item.appearsAtMs]));
  const entered = new Set<string>(), removed = new Set<string>();
  let previousEnd = 0;
  for (const block of [...(scene.animations ?? [])].sort((a, b) => a.startMs - b.startMs)) {
    const start = block.startMs, end = start + block.durationMs;
    if (start < previousEnd || end > scene.durationMs) return "Animações devem ser sequenciais e terminar dentro da cena.";
    if (frameAt(end) <= frameAt(start)) return "Animação precisa ocupar pelo menos um frame.";
    const children = childrenOf(block);
    if (block.kind === "parallel") {
      if (children.length < 2 || children.some(child => child.kind === "parallel"))
        return "Grupo paralelo precisa de pelo menos duas animações, sem grupos aninhados.";
      if (children.some(child => child.startMs !== start || child.durationMs !== block.durationMs))
        return "Animações do grupo devem compartilhar início e duração.";
    } else if (block.clips) return "Somente grupos paralelos aceitam filhos.";
    const touched = new Set<string>(), pending: [string, number][] = [];
    for (const clip of children) {
      const target = clip.targetId, element = scene.elements[target ?? ""];
      if (!target || !element) return "Animação referencia um elemento inexistente.";
      if (touched.has(target)) return "O mesmo elemento não pode receber duas animações no grupo.";
      touched.add(target);
      if (removed.has(target) || !available.has(target) || start < available.get(target)!)
        return "O elemento não está disponível nesse instante.";
      if (end > (element.disappearsAtMs ?? scene.durationMs)) return "A animação ultrapassa o fim do elemento.";
      if (isEntrance(clip.kind)) {
        if (entered.has(target) || owners.has(target) || start !== available.get(target))
          return "A entrada deve começar junto com o elemento, uma única vez.";
        entered.add(target);
      }
      if (clip.kind === "moveTo" && !clip.destination) return "Movimento precisa de uma posição de destino.";
      if (clip.kind !== "moveTo" && clip.destination) return "Somente movimento aceita uma posição de destino.";
      if (clip.kind !== "transform" && clip.destinationId) return "Somente Transform aceita um elemento destino.";
      if (clip.kind === "transform") {
        const destination = clip.destinationId!;
        if (available.has(destination) || removed.has(destination) || touched.has(destination)) return "O destino de Transform deve estar oculto.";
        if ((scene.elements[destination].disappearsAtMs ?? scene.durationMs) <= end) return "O destino precisa permanecer na cena após Transform.";
        touched.add(destination); pending.push([destination, end]); removed.add(target);
      }
      if (clip.kind === "fadeOut") removed.add(target);
    }
    for (const [id, time] of pending) available.set(id, time);
    for (const [id, item] of Object.entries(scene.elements)) {
      const times = [item.disappearsAtMs ?? scene.durationMs];
      if (!owners.has(id)) times.push(item.appearsAtMs);
      if (times.some(time => start < time && time < end))
        return "Aparição ou corte durante outra animação: ajuste o intervalo ou use um grupo paralelo.";
    }
    previousEnd = end;
  }
  return null;
}

export function removeElement(project: Project, identifier: string): Project {
  const elements = { ...project.scene.elements };
  delete elements[identifier];
  const retained = (clip: Animation) => clip.targetId !== identifier && clip.destinationId !== identifier;
  const animations = (project.scene.animations ?? []).flatMap(clip => {
    if (clip.kind !== "parallel") return retained(clip) ? [clip] : [];
    const clips = childrenOf(clip).filter(retained);
    return clips.length > 1 ? [{ ...clip, clips: clips as [Animation, Animation, ...Animation[]] }] : clips;
  });
  return { ...project, scene: { ...project.scene, elements, animations } };
}
