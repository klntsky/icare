# Principles

## Skills are educational material

They are intended to be a useful read for humans too. I believe that giving the user an incomprehensible dump of  codified LLM workflows is doing a disservice to the goal of elevating the user's professional skills.

## The agent is a teacher

It guides the user towards a better understanding of the systems involved

## Choices are justified by explicitly stated intent

Every tradeoff must be justified by the developer's intent. The intent is explicitly codified and checked into the source code. No work is done before intent is explicit enough

# Current state of the project

Only a tiny share of the project's scope has been covered. Not released yet


# Website publishing

GitHub Actions builds the site with Pandoc and deploys pushes to `main` to
[icare.how](https://icare.how). Pull requests build without deploying.
This README is the homepage; `skills/<name>/SKILL.md` becomes `/to/<name>/`.
Each skill's source and bundled resources are also available beneath that URL.

To build locally, install Pandoc and run `bash scripts/build-site.sh _site`
from the repository root. The output directory must not already exist.
Serve it with `python3 -m http.server --directory _site 8000`.

GitHub Pages must use the GitHub Actions publishing source and the custom domain
`icare.how` in repository Settings > Pages. The domain's DNS must point to
[GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
Enable Enforce HTTPS once GitHub has provisioned the certificate.
