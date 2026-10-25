import type { DirectoryWikipedia } from "../explore-directory-api";
import styles from "../explore.module.css";

export function ExploreDirectoryWikipedia({ block }: { block: DirectoryWikipedia | null }) {
  if (!block?.extract) return null;
  return (
    <section className={styles.directorySection}>
      <h2>About</h2>
      <p className={styles.directoryAbout}>{block.extract}</p>
      <p className={styles.directoryCredit}>
        <a href={block.url} target="_blank" rel="noreferrer">
          {block.attribution}
        </a>
      </p>
    </section>
  );
}
