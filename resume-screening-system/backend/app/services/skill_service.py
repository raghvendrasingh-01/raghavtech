"""Skill extraction and gap analysis.

Given a job description and a résumé, this module determines:

* **required** – skills mentioned in the job description,
* **matched**  – required skills that also appear in the résumé, and
* **missing**  – required skills absent from the résumé.

Detection is driven by a curated *skill bank* (canonical names + aliases) so we
get high-precision matches on real technologies rather than arbitrary nouns.
Matching is done with word-boundary-aware regexes that also handle symbol-heavy
skills such as ``C++``, ``C#``, ``.NET`` and ``node.js``. Ambiguous aliases that
collide with common English words (e.g. a bare "go", "r", "node", "spring") are
deliberately avoided to keep precision high.
"""

from __future__ import annotations

import re
from functools import lru_cache

# ---------------------------------------------------------------------------
# Curated skill bank: canonical name -> list of alias strings to search for.
# Aliases are matched case-insensitively with word boundaries. Keep canonical
# names presentation-ready (they are returned to the UI as-is).
# ---------------------------------------------------------------------------
SKILL_BANK: dict[str, list[str]] = {
    # Languages
    "Python": ["python"],
    "JavaScript": ["javascript", "js"],
    "TypeScript": ["typescript", "ts"],
    "Java": ["java"],
    "C++": [r"c\+\+", "cpp"],
    "C#": [r"c#", "c sharp"],
    "Go": ["golang", "go lang"],
    "Rust": ["rust"],
    "Ruby": ["ruby"],
    "PHP": ["php"],
    "Swift": ["swift"],
    "Kotlin": ["kotlin"],
    "SQL": ["sql"],
    # A bare "r" matches far too much English; require explicit context.
    "R": ["r programming", "r language", "rstats", "rlang"],
    "Scala": ["scala"],
    "Bash": ["bash", "shell scripting", "shell script"],
    "Perl": ["perl"],
    "Lua": ["lua"],
    "Elixir": ["elixir"],
    "Haskell": ["haskell"],
    # Frontend
    "React": ["react", "react.js", "reactjs"],
    "Vue": ["vue", "vue.js", "vuejs"],
    "Angular": ["angular"],
    "Next.js": ["next.js", "nextjs"],
    "Svelte": ["svelte", "sveltekit"],
    "HTML": ["html", "html5"],
    "CSS": ["css", "css3"],
    "Tailwind CSS": ["tailwind", "tailwindcss", "tailwind css"],
    "Redux": ["redux"],
    "Webpack": ["webpack"],
    "Vite": ["vite"],
    # Backend / frameworks
    "FastAPI": ["fastapi", "fast api"],
    "Flask": ["flask"],
    "Django": ["django"],
    "Node.js": ["node.js", "nodejs"],
    "Express": ["express", "express.js"],
    "Spring": ["spring boot", "spring framework"],
    ".NET": [r"\.net", "dotnet", "asp.net"],
    "GraphQL": ["graphql"],
    "REST": ["restful", "rest api", "rest apis"],
    "gRPC": ["grpc"],
    "Celery": ["celery"],
    "SQLAlchemy": ["sqlalchemy"],
    # Data / ML
    "Pandas": ["pandas"],
    "NumPy": ["numpy"],
    "PyTorch": ["pytorch", "torch"],
    "TensorFlow": ["tensorflow"],
    "scikit-learn": ["scikit-learn", "sklearn", "scikit learn"],
    "Machine Learning": ["machine learning"],
    "Deep Learning": ["deep learning"],
    "NLP": ["nlp", "natural language processing"],
    "LangChain": ["langchain", "lang chain"],
    "LlamaIndex": ["llamaindex", "llama index", "llama-index"],
    "Hugging Face": ["hugging face", "huggingface", "transformers"],
    "Spark": ["spark", "apache spark", "pyspark"],
    "Kafka": ["kafka", "apache kafka"],
    "Airflow": ["airflow", "apache airflow"],
    "dbt": ["dbt", "data build tool"],
    "Databricks": ["databricks"],
    "Snowflake": ["snowflake"],
    "Tableau": ["tableau"],
    "Power BI": ["power bi", "powerbi"],
    "Looker": ["looker"],
    # Databases
    "PostgreSQL": ["postgresql", "postgres"],
    "MySQL": ["mysql"],
    "MongoDB": ["mongodb", "mongo"],
    "Redis": ["redis"],
    "Elasticsearch": ["elasticsearch", "elastic search"],
    "SQLite": ["sqlite"],
    "Cassandra": ["cassandra", "apache cassandra"],
    "DynamoDB": ["dynamodb"],
    "Neo4j": ["neo4j"],
    "Pinecone": ["pinecone"],
    "Weaviate": ["weaviate"],
    # DevOps / cloud
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "AWS": ["aws", "amazon web services"],
    "Azure": ["azure", "microsoft azure"],
    "GCP": ["gcp", "google cloud"],
    "Terraform": ["terraform"],
    "Ansible": ["ansible"],
    "Pulumi": ["pulumi"],
    "CI/CD": ["ci/cd", "cicd", "continuous integration"],
    "Jenkins": ["jenkins"],
    "GitHub Actions": ["github actions"],
    "GitLab CI": ["gitlab ci", "gitlab-ci"],
    "Linux": ["linux"],
    "Git": ["git"],
    "Nginx": ["nginx"],
    # Testing
    "pytest": ["pytest"],
    "Jest": ["jest"],
    "Playwright": ["playwright"],
    "Selenium": ["selenium"],
    "Cypress": ["cypress"],
    # Project / process
    "Jira": ["jira"],
    "Confluence": ["confluence"],
    "Figma": ["figma"],
    # Practices / misc
    "Microservices": ["microservices", "microservice"],
    "Agile": ["agile", "scrum"],
    "System Design": ["system design"],
    "Data Structures": ["data structures"],
    "Algorithms": ["algorithms"],
}


@lru_cache(maxsize=1)
def _compiled_bank() -> list[tuple[str, re.Pattern]]:
    """Pre-compile one combined regex per canonical skill (case-insensitive)."""
    compiled: list[tuple[str, re.Pattern]] = []
    for canonical, aliases in SKILL_BANK.items():
        parts = []
        for alias in aliases:
            # Aliases containing regex metachars (c\+\+, \.net, \br\b) are used
            # verbatim; plain aliases get token boundaries that treat an
            # intra-token dot as part of the token — so "js" does NOT match
            # inside "node.js", while a trailing sentence dot ("React.") still
            # matches. The guards reject a neighbouring word char, or a dot that
            # is itself glued to a word char (i.e. a real token separator).
            if any(ch in alias for ch in "\\+.#()[]"):
                parts.append(alias)
            else:
                esc = re.escape(alias)
                parts.append(rf"(?<!\w)(?<!\w\.){esc}(?!\w)(?!\.\w)")
        pattern = re.compile("|".join(parts), re.IGNORECASE)
        compiled.append((canonical, pattern))
    return compiled


def extract_known_skills(text: str) -> set[str]:
    """Return the set of canonical skill-bank skills present in ``text``."""
    if not text:
        return set()
    found: set[str] = set()
    for canonical, pattern in _compiled_bank():
        if pattern.search(text):
            found.add(canonical)
    return found


def _count_skill_frequency(skill: str, text: str) -> int:
    """Count how many times a canonical skill appears in ``text``."""
    for canonical, pattern in _compiled_bank():
        if canonical == skill:
            return len(pattern.findall(text))
    return 0


def analyze_skills(resume_text: str, jd_text: str) -> dict:
    """Compare JD-required skills against the résumé.

    Args:
        resume_text: Plain text extracted from the résumé.
        jd_text: Plain text of the job description.

    Returns:
        A dict with five fields::

            {
                "required": [...],          # skills detected in the JD (sorted)
                "matched":  [...],          # required skills found in the résumé
                "missing":  [...],          # required skills absent from the résumé
                "missing_ranked": [         # missing skills sorted by JD frequency
                    {"skill": str, "jd_frequency": int}, ...
                ],
                "quick_wins": [...],        # top-3 missing skills by JD frequency
            }

        The first three lists are unchanged from the original contract so
        existing clients keep working. The last two are additive.
    """
    jd_skills = extract_known_skills(jd_text)
    resume_skills = extract_known_skills(resume_text)

    matched = jd_skills & resume_skills
    missing = jd_skills - resume_skills

    # Rank missing skills by how often they appear in the JD (higher = more
    # important to the employer).
    missing_ranked = sorted(
        [
            {"skill": s, "jd_frequency": _count_skill_frequency(s, jd_text)}
            for s in missing
        ],
        key=lambda x: x["jd_frequency"],
        reverse=True,
    )
    quick_wins = [item["skill"] for item in missing_ranked[:3]]

    return {
        "required": sorted(jd_skills),
        "matched": sorted(matched),
        "missing": sorted(missing),
        "missing_ranked": missing_ranked,
        "quick_wins": quick_wins,
    }
