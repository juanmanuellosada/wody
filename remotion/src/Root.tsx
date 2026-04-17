import { Composition } from "remotion";
import { CuponeraPromo } from "./CuponeraPromo";
import { TimersPromo } from "./TimersPromo";

export const Root = () => {
  return (
    <>
      <Composition
        id="CuponeraPromo"
        component={CuponeraPromo}
        durationInFrames={600}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="TimersPromo"
        component={TimersPromo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
