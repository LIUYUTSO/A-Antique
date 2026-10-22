import LandingStage from '@/components/LandingStage';
import SpreadView from '@/components/SpreadView';
import { FEATURED_ID, getObject, getObjects, stillFor } from '@/lib/objects';

export default function Landing() {
  const featured = getObject(FEATURED_ID);
  if (!featured) throw new Error(`Featured object ${FEATURED_ID} is not in data/objects.json`);

  return (
    <LandingStage
      id={featured.id}
      name={featured.name}
      still={stillFor(featured.id)}
      count={getObjects().length}
      spread={<SpreadView id={featured.id} entrance={false} />}
    />
  );
}
