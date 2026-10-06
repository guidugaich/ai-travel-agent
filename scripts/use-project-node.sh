# Sourced, not executed: switches to the Node version in .nvmrc when nvm is installed.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" --no-use
  nvm use --silent >/dev/null 2>&1
fi
