import { Composition } from "remotion";
import { CuponeraPromo } from "./CuponeraPromo";
import { TimersPromo } from "./TimersPromo";
import { PagosPromo } from "./PagosPromo";
import { UsuariosPromo } from "./UsuariosPromo";

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
      <Composition
        id="PagosPromo"
        component={PagosPromo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="UsuariosPromo"
        component={UsuariosPromo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
