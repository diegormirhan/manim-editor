import math

FPS = 15
ENTRANCES = {"create", "write", "fadeIn"}


def frame_at(milliseconds):
    return math.floor(milliseconds * FPS / 1000 + 0.5)


def children_of(clip):
    return clip.get("clips", []) if clip["kind"] == "parallel" else [clip]


def leaf_clips(scene):
    return [child for clip in scene.get("animations", []) for child in children_of(clip)]


def lifetimes(scene):
    spans = {key: [element["appearsAtMs"], element.get("disappearsAtMs", scene["durationMs"])]
             for key, element in scene["elements"].items()}
    for clip in leaf_clips(scene):
        end = clip["startMs"] + clip["durationMs"]
        if clip["kind"] == "transform" and clip.get("destinationId") in spans:
            spans[clip["destinationId"]][0] = end
        if clip["kind"] in ("fadeOut", "transform") and clip.get("targetId") in spans:
            spans[clip["targetId"]][1] = min(spans[clip["targetId"]][1], end)
    return spans


def validate_timeline(scene):
    clips = sorted(scene.get("animations", []), key=lambda clip: clip["startMs"])
    leaves = leaf_clips(scene)
    owners = {}
    for clip in leaves:
        if clip["kind"] != "transform":
            continue
        destination = clip.get("destinationId")
        if not destination or destination not in scene["elements"] or destination == clip.get("targetId"):
            raise ValueError("Transform precisa de um destino diferente e existente.")
        if destination in owners:
            raise ValueError("Cada destino de Transform pertence a uma única transformação.")
        owners[destination] = clip

    available = {key: element["appearsAtMs"] for key, element in scene["elements"].items() if key not in owners}
    entered, removed = set(), set()
    previous_end = 0
    for block in clips:
        start, end = block["startMs"], block["startMs"] + block["durationMs"]
        if start < previous_end or end > scene["durationMs"]:
            raise ValueError("Animações devem ser sequenciais e terminar dentro da cena.")
        if frame_at(end) <= frame_at(start):
            raise ValueError("Animação precisa ocupar pelo menos um frame.")
        children = children_of(block)
        if block["kind"] == "parallel":
            if len(children) < 2 or any(child["kind"] == "parallel" for child in children):
                raise ValueError("Grupo paralelo precisa de pelo menos duas animações, sem grupos aninhados.")
            if any(child["startMs"] != start or child["durationMs"] != block["durationMs"] for child in children):
                raise ValueError("Animações do grupo devem compartilhar início e duração.")
        elif "clips" in block:
            raise ValueError("Somente grupos paralelos aceitam filhos.")
        touched, pending = set(), []
        for clip in children:
            target = clip.get("targetId")
            element = scene["elements"].get(target)
            if element is None:
                raise ValueError("Animação referencia um elemento inexistente.")
            if target in touched:
                raise ValueError("O mesmo elemento não pode receber duas animações no grupo.")
            touched.add(target)
            if target in removed or target not in available or start < available[target]:
                raise ValueError("O elemento não está disponível nesse instante.")
            if end > element.get("disappearsAtMs", scene["durationMs"]):
                raise ValueError("A animação ultrapassa o fim do elemento.")
            if clip["kind"] in ENTRANCES:
                if target in entered or target in owners or start != available[target]:
                    raise ValueError("A entrada deve começar junto com o elemento, uma única vez.")
                entered.add(target)
            if clip["kind"] == "moveTo" and "destination" not in clip:
                raise ValueError("Movimento precisa de uma posição de destino.")
            if clip["kind"] != "moveTo" and "destination" in clip:
                raise ValueError("Somente movimento aceita uma posição de destino.")
            if clip["kind"] != "transform" and "destinationId" in clip:
                raise ValueError("Somente Transform aceita um elemento destino.")
            if clip["kind"] == "transform":
                destination = clip["destinationId"]
                if destination in available or destination in removed or destination in touched:
                    raise ValueError("O destino de Transform deve estar oculto.")
                if scene["elements"][destination].get("disappearsAtMs", scene["durationMs"]) <= end:
                    raise ValueError("O destino precisa permanecer na cena após Transform.")
                touched.add(destination)
                pending.append((destination, end))
                removed.add(target)
            if clip["kind"] == "fadeOut":
                removed.add(target)
        available.update(pending)
        for identifier, item in scene["elements"].items():
            times = [item.get("disappearsAtMs", scene["durationMs"])]
            if identifier not in owners:
                times.append(item["appearsAtMs"])
            if any(start < time < end for time in times):
                raise ValueError("Aparição ou corte durante outra animação: ajuste o intervalo ou use um grupo paralelo.")
        previous_end = end


def compile_animation(clip, variable, variables=None):
    if clip["kind"] == "moveTo":
        return f"{variable}.animate.move_to({clip['destination']!r})"
    if clip["kind"] == "transform":
        return f"ReplacementTransform({variable}, {variables[clip['destinationId']]})"
    classes = {"create": "Create", "write": "Write", "fadeIn": "FadeIn", "fadeOut": "FadeOut"}
    return f"{classes[clip['kind']]}({variable})"
