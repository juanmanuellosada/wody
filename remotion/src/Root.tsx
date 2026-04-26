import { Composition } from "remotion";
import { AtlasPromo } from "./AtlasPromo";
import { CuponeraPromo } from "./CuponeraPromo";
import { MilaFitPromo } from "./MilaFitPromo";
import { PagosPromo } from "./PagosPromo";
import { RompiendoLimitesPromo } from "./RompiendoLimitesPromo";
import { TimersPromo } from "./TimersPromo";
import { UnidosGaragePromo } from "./UnidosGaragePromo";
import { UsuariosPromo } from "./UsuariosPromo";
import { ValidarPromo } from "./ValidarPromo";
import { WodyLogoIntro } from "./WodyLogoIntro";

export const Root = () => {
  return (
    <>
      <Composition
        id="AtlasPromo"
        component={AtlasPromo}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="MilaFitPromo"
        component={MilaFitPromo}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="RompiendoLimitesPromo"
        component={RompiendoLimitesPromo}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="UnidosGaragePromo"
        component={UnidosGaragePromo}
        durationInFrames={1560}
        fps={30}
        width={1080}
        height={1920}
      />
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
      <Composition
        id="ValidarPromo"
        component={ValidarPromo}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="WodyLogoIntro"
        component={WodyLogoIntro}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
