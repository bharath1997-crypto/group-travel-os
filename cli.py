import argparse, json
from ai_storyboard.providers.mock import MockProvider
from ai_storyboard.service import StoryboardService


def main():
    parser = argparse.ArgumentParser(description="AI Storyboard generator")
    parser.add_argument("idea", help="Idea or premise to storyboard")
    parser.add_argument("-o", "--out", help="Output JSON file")
    args = parser.parse_args()
    service = StoryboardService(provider=MockProvider())
    board = service.generate(args.idea)
    data = {
        "idea": board.idea,
        "beats": [b.__dict__ for b in board.beats],
        "notes": board.notes,
    }
    text = json.dumps(data, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(text)
        print(f"Wrote {args.out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
