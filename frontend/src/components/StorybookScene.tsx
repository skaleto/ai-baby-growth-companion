import companionIcon from "../assets/storybook-icons/companion.png";

export function StorybookScene() {
  return (
    <div className="storybook-scene" aria-hidden="true">
      <span className="storybook-sun" />
      <span className="storybook-cloud cloud-one" />
      <span className="storybook-cloud cloud-two" />
      <span className="storybook-star star-one" />
      <span className="storybook-star star-two" />
      <span className="storybook-baby">
        <img src={companionIcon} alt="" />
      </span>
    </div>
  );
}
