import { Composition } from "remotion";
import { ReelProduto } from "./ReelProduto";

export function Root() {
  return (
    <Composition
      id="ReelProduto"
      component={ReelProduto}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />
  );
}
