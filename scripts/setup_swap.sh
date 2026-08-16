#!/usr/bin/env bash
# script to setup a 4GB swap space safely

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo)"
  exit 1
fi

SWAP_FILE="/swapfile"
SWAP_SIZE="4G"

if [ -f "$SWAP_FILE" ]; then
    echo "Swapfile $SWAP_FILE already exists."
else
    echo "Creating $SWAP_SIZE swapfile..."
    fallocate -l $SWAP_SIZE $SWAP_FILE
    if [ $? -ne 0 ]; then
        echo "fallocate failed, trying dd..."
        dd if=/dev/zero of=$SWAP_FILE bs=1M count=4096
    fi
    
    chmod 600 $SWAP_FILE
    mkswap $SWAP_FILE
    swapon $SWAP_FILE
    
    # Add to fstab if not present
    if ! grep -q "$SWAP_FILE" /etc/fstab; then
        echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
    fi
    
    echo "Swap space successfully created and enabled."
fi

# Tweak swappiness for better performance on database servers
sysctl vm.swappiness=10
if ! grep -q "vm.swappiness" /etc/sysctl.conf; then
    echo "vm.swappiness=10" >> /etc/sysctl.conf
fi

echo "Current swap status:"
free -m
