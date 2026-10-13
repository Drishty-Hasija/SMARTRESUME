"""Rule-based skill extraction driven by data/skills.json.

Every alias of every skill is compiled into one regular expression
(longest alias first) so that, for example, "react native" is matched as one
skill instead of "react". Boundaries are checked with look-arounds that
treat letters, digits, '+' and '#' as word characters, so "Java" does not
match inside "JavaScript" and "C++" is matched as a whole.
"""
import json
import re
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

from app.config import get_settings

_LEFT = r"(?<![A-Za-z0-9+#])"
_RIGHT = r"(?![A-Za-z0-9+#])"


def _alias_pattern(alias: str) -> str:
    return re.escape(alias).replace(r"\ ", r"\s+")


class SkillExtractor:
    def __init__(self, path: Path):
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        self.categories: dict[str, dict] = data["categories"]
        self.skill_category: dict[str, str] = {}
        self._ci_alias: dict[str, str] = {}   # lowercase alias -> canonical skill
        self._cs_alias: dict[str, str] = {}   # exact-case alias -> canonical skill

        for category, skills in self.categories.items():
            for name, spec in skills.items():
                self.skill_category[name] = category
                if isinstance(spec, dict):
                    for alias in spec.get("aliases", []):
                        target = self._cs_alias if spec.get("case_sensitive") else self._ci_alias
                        key = alias if spec.get("case_sensitive") else alias.lower()
                        target[key] = name
                else:
                    for alias in spec:
                        self._ci_alias[alias.lower()] = name

        self._ci_regex = self._compile(self._ci_alias, re.IGNORECASE)
        self._cs_regex = self._compile(self._cs_alias, 0)

        # Single lower-case tokens that must never be lemmatised (e.g. "pandas").
        self.protected_tokens: set[str] = {
            a for a in self._ci_alias if " " not in a
        } | {a.lower() for a in self._cs_alias if " " not in a}

    @staticmethod
    def _compile(alias_map: dict[str, str], flags: int):
        if not alias_map:
            return None
        aliases = sorted(alias_map, key=len, reverse=True)
        body = "|".join(_alias_pattern(a) for a in aliases)
        return re.compile(f"{_LEFT}(?:{body}){_RIGHT}", flags)

    # ------------------------------------------------------------------ API
    def extract(self, text: str) -> list[dict]:
        """Return detected skills: [{name, category, count, matched}], most frequent first."""
        counts: Counter[str] = Counter()
        matched: dict[str, set[str]] = defaultdict(set)

        if self._ci_regex:
            for m in self._ci_regex.finditer(text):
                skill = self._ci_alias[re.sub(r"\s+", " ", m.group(0).lower())]
                counts[skill] += 1
                matched[skill].add(m.group(0).lower())
        if self._cs_regex:
            for m in self._cs_regex.finditer(text):
                skill = self._cs_alias[re.sub(r"\s+", " ", m.group(0))]
                counts[skill] += 1
                matched[skill].add(m.group(0).lower())

        hits = [
            {
                "name": name,
                "category": self.skill_category[name],
                "count": count,
                "matched": sorted(matched[name]),
            }
            for name, count in counts.items()
        ]
        hits.sort(key=lambda h: (-h["count"], h["name"].lower()))
        return hits

    def extract_names(self, text: str) -> set[str]:
        return {h["name"] for h in self.extract(text)}

    @staticmethod
    def group_by_category(hits: list[dict]) -> dict[str, list[str]]:
        grouped: dict[str, list[str]] = defaultdict(list)
        for h in hits:
            grouped[h["category"]].append(h["name"])
        return dict(sorted(grouped.items(), key=lambda kv: (-len(kv[1]), kv[0])))

    def stats(self) -> dict:
        return {
            "total_skills": len(self.skill_category),
            "categories": {c: len(s) for c, s in self.categories.items()},
        }


@lru_cache(maxsize=1)
def get_skill_extractor() -> SkillExtractor:
    return SkillExtractor(get_settings().skills_path)
