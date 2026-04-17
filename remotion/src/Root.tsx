import { Composition } from "remotion";
import { CuponeraPromo } from "./CuponeraPromo";

export const Root = () => {
  return (
    <Composition
      id="CuponeraPromo"
      component={CuponeraPromo}
      durationInFrames={600}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
